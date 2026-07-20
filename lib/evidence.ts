import { promises as fs } from "fs";
import os from "os";
import nodePath from "path";
import chromium from "@sparticuz/chromium";
import {
  chromium as playwright,
  type Browser,
  type BrowserContext,
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

/**
 * Un paso del recorrido de QA. Los pasos se ejecutan en orden mientras se graba
 * el video, de modo que el .webm muestre la funcionalidad en uso (no una pantalla
 * quieta). Cada acción mapea a una operación de Playwright.
 *
 *  - goto:       navegar a una ruta relativa de la app
 *  - click:      click en un selector (soporta text=, :has-text(), >> de Playwright)
 *  - fill:       escribir en un input (con verificación de value, anti-hidratación)
 *  - select:     elegir opción de un <select> nativo (por value o label)
 *  - hover:      pasar el mouse por encima (revela menús/tooltips)
 *  - press:      tecla (Enter, Escape, etc.)
 *  - waitFor:    esperar por texto visible, por selector, o por ms fijos
 *  - scroll:     scrollear al top/bottom o hasta un selector
 *  - screenshot: capturar y adjuntar un PNG en ese punto del recorrido
 */
export type Step =
  | { action: "goto"; path: string }
  | { action: "click"; selector: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "select"; selector: string; value: string }
  | { action: "hover"; selector: string }
  | { action: "press"; key: string }
  | { action: "waitFor"; text?: string; selector?: string; ms?: number }
  | { action: "scroll"; to?: "top" | "bottom"; selector?: string }
  | { action: "screenshot"; name?: string; fullPage?: boolean };

export interface EvidenceInput {
  app?: string; // clave -> EVIDENCE_<APP>_BASEURL/EMAIL/PASSWORD/SIGNIN_PATH
  baseUrl?: string; // alternativa/override a `app`
  paths?: string[]; // recorrido simple: solo navega y captura cada ruta
  steps?: Step[]; // recorrido de QA: interacciones grabadas (tiene prioridad sobre paths)
  taskGid: string;
  comment?: string;
  fullPage?: boolean;
  capture?: CaptureMode;
  settleMs?: number; // pausa tras cada paso para que el video sea legible (default 700)
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
 * todavía no está enganchado y el value se pierde. Independiente de timing:
 * llena, lee el value y reintenta hasta que pegue (o falla ruidosamente).
 */
async function fillReliable(page: Page, selector: string, value: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await page.fill(selector, value);
    await page.waitForTimeout(150);
    if ((await page.inputValue(selector).catch(() => "")) === value) return; // pegó
  }
  throw new EvidenceError(
    `No se pudo setear ${selector} (input controlado no hidratado)`,
    502
  );
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
  const { paths, steps, taskGid } = input;
  const hasSteps = Array.isArray(steps) && steps.length > 0;
  const hasPaths = Array.isArray(paths) && paths.length > 0;
  if ((!hasSteps && !hasPaths) || !taskGid) {
    throw new EvidenceError("Faltan steps[] o paths[], o taskGid", 400);
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

      // Email primero, verificado; recién después password y submit.
      await fillReliable(page, 'input[type="email"]', email);
      await fillReliable(page, 'input[type="password"]', password);
      await page.click('button:has-text("Ingresar")');

      // Confirmar que salió del login. Si no prospera, fallar ruidosamente en
      // vez de seguir y capturar el login en silencio.
      try {
        await page.waitForURL((url) => !/\/login|\/auth/.test(url.href), { timeout: 15000 });
      } catch {
        throw new EvidenceError(
          `El login no prosperó (sigue en ${new URL(page.url()).pathname}). ` +
            `Revisá credenciales/selectores de la app "${input.app ?? "?"}".`,
          502
        );
      }
    }

    // Helper: captura un PNG y lo adjunta a la tarea.
    const shoot = async (label: string, fullPage: boolean) => {
      const png = await page.screenshot({ fullPage, type: "png" });
      const safe = label.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "shot";
      const att = await attachFile(taskGid, png, `${safe}.png`, "image/png");
      results.push({ path: label, attachmentGid: att.gid });
    };

    const settleMs = input.settleMs ?? 700;

    if (hasSteps) {
      // Recorrido de QA: ejecuta las interacciones en orden mientras se graba el
      // video. Si un paso falla, se corta el recorrido pero igual se finaliza y
      // adjunta el video (para ver DÓNDE falló) y se reporta el error.
      let shotCount = 0;
      for (let i = 0; i < steps!.length; i++) {
        const s = steps![i];
        const tag = `paso ${i + 1}: ${s.action}`;
        try {
          switch (s.action) {
            case "goto":
              await page.goto(`${baseUrl}${s.path}`, { waitUntil: "networkidle", timeout: 60000 });
              await page.waitForTimeout(1200); // datos async
              break;
            case "click":
              await page.click(s.selector, { timeout: 15000 });
              break;
            case "fill":
              await fillReliable(page, s.selector, s.value);
              break;
            case "select":
              // Intenta por value y por label (elige lo que exista).
              await page.selectOption(s.selector, [{ value: s.value }, { label: s.value }], {
                timeout: 15000,
              });
              break;
            case "hover":
              await page.hover(s.selector, { timeout: 15000 });
              break;
            case "press":
              await page.keyboard.press(s.key);
              break;
            case "waitFor":
              if (s.text) {
                await page.getByText(s.text, { exact: false }).first().waitFor({ timeout: 15000 });
              } else if (s.selector) {
                await page.waitForSelector(s.selector, { timeout: 15000 });
              } else if (s.ms) {
                await page.waitForTimeout(s.ms);
              }
              break;
            case "scroll":
              if (s.selector) {
                await page.locator(s.selector).first().scrollIntoViewIfNeeded({ timeout: 15000 });
              } else {
                await page.evaluate(
                  (to) => window.scrollTo({ top: to === "top" ? 0 : document.body.scrollHeight, behavior: "smooth" }),
                  s.to ?? "bottom"
                );
              }
              break;
            case "screenshot":
              shotCount++;
              await shoot(s.name ?? `recorrido_${shotCount}`, s.fullPage ?? input.fullPage ?? true);
              break;
          }
          await page.waitForTimeout(settleMs); // legibilidad del video
        } catch (e) {
          results.push({ path: tag, error: e instanceof Error ? e.message : String(e) });
          break; // corta el recorrido; el video igual se adjunta abajo
        }
      }
      // Si se pidió foto (screenshot/both) y no hubo un paso screenshot explícito,
      // deja una captura final del estado alcanzado.
      if (wantShots && shotCount === 0) {
        await shoot("recorrido_final", input.fullPage ?? true).catch((e) =>
          results.push({ path: "recorrido_final", error: e instanceof Error ? e.message : String(e) })
        );
      }
    } else {
      // Recorrido simple por los paths. Con video, esta navegación queda grabada.
      for (const p of paths!) {
        try {
          await page.goto(`${baseUrl}${p}`, { waitUntil: "networkidle", timeout: 60000 });
          await page.waitForTimeout(1500); // datos async
          if (wantShots) {
            await shoot(p, input.fullPage ?? true);
          } else {
            results.push({ path: p });
          }
        } catch (e) {
          results.push({ path: p, error: e instanceof Error ? e.message : String(e) });
        }
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
        const stamp = hasSteps || (paths && paths.length > 1) ? "recorrido_qa" : "recorrido";
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
