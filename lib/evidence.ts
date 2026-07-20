import { promises as fs } from "fs";
import os from "os";
import nodePath from "path";
import chromium from "@sparticuz/chromium";
import {
  chromium as playwright,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright-core";
import { addComment, attachFile } from "@/lib/asana";

/**
 * Núcleo de la herramienta de evidencia. Recorre una o más pantallas de una app
 * (login por formulario si hace falta) y adjunta la evidencia a una tarea de
 * Asana. Lo usan tanto el endpoint `/api/evidence` (protegido por API key) como
 * la página `/evidencia` (protegida por el login de `bots`).
 */

export type CaptureMode = "screenshot" | "video" | "both";

export interface EvidenceInput {
  app?: string; // clave -> EVIDENCE_<APP>_BASEURL/EMAIL/PASSWORD/SIGNIN_PATH
  baseUrl?: string; // alternativa/override a `app`
  paths: string[];
  taskGid: string;
  comment?: string;
  fullPage?: boolean;
  capture?: CaptureMode;
  login?: { email: string; password: string; signinPath?: string };
}

export interface EvidenceResult {
  success: boolean;
  attached: number;
  total: number;
  results: Array<{ path: string; attachmentGid?: string; error?: string }>;
}

// Playwright graba video con un binario ffmpeg propio que resuelve desde su
// registry. Con PLAYWRIGHT_BROWSERS_PATH=0 lo busca dentro de node_modules
// (donde lo instala el build), así entra al bundle de la función.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";

const VIEWPORT = { width: 1440, height: 900 };

/**
 * Llena un input y verifica que el value haya quedado. Los inputs de las apps
 * son controlados por React: si se llenan antes de la hidratación, el onChange
 * todavía no está enganchado y el value se pierde. Reintentamos hasta que quede
 * (o se agoten los intentos). `fill()` dispara los eventos que React necesita.
 */
async function fillStable(
  page: Page,
  locator: Locator,
  value: string,
  retries = 6
): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    await locator.fill(value);
    if ((await locator.inputValue().catch(() => "")) === value) return;
    await page.waitForTimeout(300); // esperar a que hidrate y reintentar
  }
}

/**
 * El file-tracing de Vercel puede no preservar el bit de ejecución del binario
 * de ffmpeg. Antes de grabar, lo buscamos en node_modules y le forzamos +x.
 * Best-effort: si algo falla, dejamos que Playwright reporte el error real.
 */
async function ensureFfmpegExecutable(): Promise<void> {
  try {
    const base = nodePath.join(
      process.cwd(),
      "node_modules/playwright-core/.local-browsers"
    );
    const dirs = await fs.readdir(base).catch(() => [] as string[]);
    for (const d of dirs) {
      if (!d.startsWith("ffmpeg")) continue;
      const dir = nodePath.join(base, d);
      for (const f of await fs.readdir(dir).catch(() => [] as string[])) {
        if (f.startsWith("ffmpeg")) {
          await fs.chmod(nodePath.join(dir, f), 0o755).catch(() => {});
        }
      }
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Extrae el gid de tarea de un link de Asana (o acepta el gid pelado).
 * Formatos: .../0/<proj>/<taskGid>[/f], .../1/<ws>/project/<proj>/task/<taskGid>,
 * o el gid solo. Heurística: el gid es la última secuencia numérica larga.
 */
export function parseTaskGid(input: string): string | null {
  const raw = input.trim();
  if (/^\d{6,}$/.test(raw)) return raw;
  const matches = raw.match(/\d{6,}/g);
  if (!matches || matches.length === 0) return null;
  return matches[matches.length - 1];
}

/** Lista las apps configuradas escaneando el env por EVIDENCE_<APP>_BASEURL. */
export function listConfiguredApps(): string[] {
  const apps = new Set<string>();
  for (const key of Object.keys(process.env)) {
    const m = /^EVIDENCE_(.+)_BASEURL$/.exec(key);
    if (m && process.env[key]) apps.add(m[1].toLowerCase());
  }
  return Array.from(apps).sort();
}

/** Error con status HTTP asociado, para que el endpoint elija el código. */
export class EvidenceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function runEvidence(input: EvidenceInput): Promise<EvidenceResult> {
  const { paths, taskGid } = input;
  if (!Array.isArray(paths) || paths.length === 0 || !taskGid) {
    throw new EvidenceError("Faltan paths[] o taskGid", 400);
  }
  const capture: CaptureMode = input.capture ?? "screenshot";
  const wantVideo = capture === "video" || capture === "both";
  const wantShots = capture === "screenshot" || capture === "both";

  // Resolución de config por app. Si viene `app`, se leen las env con prefijo
  // EVIDENCE_<APP>_* (multi-app). Si viene `baseUrl` directo, se usa el esquema
  // global (compat). Los secretos SIEMPRE salen del env.
  let baseUrl: string | undefined;
  let email: string | undefined;
  let password: string | undefined;
  let signinPath: string;
  if (input.app) {
    const K = input.app.toUpperCase().replace(/[^A-Z0-9]/g, "");
    baseUrl = input.baseUrl ?? process.env[`EVIDENCE_${K}_BASEURL`];
    email = process.env[`EVIDENCE_${K}_EMAIL`];
    password = process.env[`EVIDENCE_${K}_PASSWORD`];
    signinPath = process.env[`EVIDENCE_${K}_SIGNIN_PATH`] ?? "/auth/signin";
    if (!baseUrl) {
      throw new EvidenceError(
        `App "${input.app}" no configurada (falta EVIDENCE_${K}_BASEURL en el env)`,
        400
      );
    }
  } else {
    baseUrl = input.baseUrl;
    email = input.login?.email ?? process.env.EVIDENCE_EMAIL;
    password = input.login?.password ?? process.env.EVIDENCE_PASSWORD;
    signinPath = input.login?.signinPath ?? "/auth/signin";
    if (!baseUrl) {
      throw new EvidenceError("Falta `app` o `baseUrl`", 400);
    }
  }

  const results: EvidenceResult["results"] = [];
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let videoDir: string | null = null;

  try {
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    // Un BrowserContext por request. Si se pide video, Playwright graba .webm
    // nativo (sin ffmpeg) hacia un directorio en /tmp; el archivo se finaliza al
    // cerrar el context.
    if (wantVideo) {
      await ensureFfmpegExecutable();
      videoDir = await fs.mkdtemp(nodePath.join(os.tmpdir(), "evidence-video-"));
    }
    context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      ...(videoDir ? { recordVideo: { dir: videoDir, size: VIEWPORT } } : {}),
    });
    const page = await context.newPage();

    // Login opcional (para páginas con sesión).
    if (email && password) {
      await page.goto(`${baseUrl}${signinPath}`, { waitUntil: "networkidle", timeout: 60000 });
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      await emailInput.waitFor({ state: "visible", timeout: 60000 });

      // Email primero, verificando que el value quedó (esto además da tiempo a
      // que la página termine de hidratar); recién ahí password y submit.
      await fillStable(page, emailInput, email);
      await fillStable(page, passwordInput, password);

      // Click real del botón "Ingresar" (auto-wait + eventos que React espera).
      const submit = page.getByRole("button", { name: /ingresar/i });
      if (await submit.count()) {
        await submit.first().click();
      } else {
        // Fallback: si no matchea por rol/nombre, buscar por texto en el DOM.
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find((b) =>
            /ingresar/i.test(b.textContent || "")
          );
          (btn as HTMLButtonElement | undefined)?.click();
        });
      }
      await page
        .waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 60000 })
        .catch(() => {});
    }

    // Recorrido por los paths. Con video, esta navegación queda grabada.
    for (const p of paths) {
      try {
        await page.goto(`${baseUrl}${p}`, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(1500); // datos async
        if (wantShots) {
          const png = await page.screenshot({ fullPage: input.fullPage ?? true, type: "png" });
          const safe = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
          const att = await attachFile(taskGid, png, `${safe}.png`, "image/png");
          results.push({ path: p, attachmentGid: att.gid });
        } else {
          results.push({ path: p });
        }
      } catch (e) {
        results.push({ path: p, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Cerrar el context finaliza el archivo de video. Recién ahí podemos leerlo.
    if (wantVideo) {
      const video = page.video();
      await context.close();
      context = null;
      const videoPath = video ? await video.path() : undefined;
      if (videoPath) {
        const bytes = await fs.readFile(videoPath);
        const stamp = paths.length === 1 ? "recorrido" : `recorrido_${paths.length}p`;
        const att = await attachFile(taskGid, bytes, `${stamp}.webm`, "video/webm");
        results.push({ path: "(video)", attachmentGid: att.gid });
      } else {
        results.push({ path: "(video)", error: "No se generó el archivo de video" });
      }
    }

    if (input.comment) {
      await addComment(taskGid, input.comment);
    }
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (videoDir) await fs.rm(videoDir, { recursive: true, force: true }).catch(() => {});
  }

  const ok = results.filter((r) => r.attachmentGid).length;
  return { success: true, attached: ok, total: results.length, results };
}
