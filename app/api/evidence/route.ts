import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { addComment, attachFile } from "@/lib/asana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Mini-app de "evidencia gráfica": captura una o más pantallas de una app y las
 * adjunta a una tarea de Asana (+ comentario opcional). La captura corre en la
 * nube con un Chromium serverless (@sparticuz/chromium + puppeteer-core), así no
 * depende de ninguna máquina local.
 *
 * POST /api/evidence
 *   Header:  x-evidence-key: <EVIDENCE_API_KEY>
 *   Body:    { app, paths: string[], taskGid, comment?, fullPage? }
 *            (multi-app: `app` -> EVIDENCE_<APP>_BASEURL/EMAIL/PASSWORD/SIGNIN_PATH.
 *             Compat: se puede pasar `baseUrl`+`login` directo en vez de `app`.)
 *
 * Login (opcional): si EVIDENCE_EMAIL/EVIDENCE_PASSWORD está en el env (o se pasa
 * `login`), completa el formulario /auth/signin de la app target antes de
 * capturar (para páginas con sesión). Los secretos SIEMPRE vienen del env.
 */

interface Body {
  app?: string; // clave de app -> resuelve EVIDENCE_<APP>_BASEURL/EMAIL/PASSWORD/SIGNIN_PATH
  baseUrl?: string; // alternativa a `app` (compat): URL directa
  paths: string[];
  taskGid: string;
  comment?: string;
  fullPage?: boolean;
  login?: { email: string; password: string; signinPath?: string };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.EVIDENCE_API_KEY;
  if (apiKey && request.headers.get("x-evidence-key") !== apiKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { paths, taskGid } = body;
  if (!Array.isArray(paths) || paths.length === 0 || !taskGid) {
    return NextResponse.json({ error: "Faltan paths[] o taskGid" }, { status: 400 });
  }

  // Resolución de config por app. Si viene `app`, se leen las env con prefijo
  // EVIDENCE_<APP>_* (multi-app). Si viene `baseUrl` directo, se usa el esquema
  // global (compat). Los secretos SIEMPRE salen del env.
  let baseUrl: string | undefined;
  let email: string | undefined;
  let password: string | undefined;
  let signinPath: string;
  if (body.app) {
    const K = body.app.toUpperCase().replace(/[^A-Z0-9]/g, "");
    // `baseUrl` opcional overridea el env (útil para apuntar a un preview de la
    // misma app usando sus credenciales).
    baseUrl = body.baseUrl ?? process.env[`EVIDENCE_${K}_BASEURL`];
    email = process.env[`EVIDENCE_${K}_EMAIL`];
    password = process.env[`EVIDENCE_${K}_PASSWORD`];
    signinPath = process.env[`EVIDENCE_${K}_SIGNIN_PATH`] ?? "/auth/signin";
    if (!baseUrl) {
      return NextResponse.json(
        { error: `App "${body.app}" no configurada (falta EVIDENCE_${K}_BASEURL en el env)` },
        { status: 400 }
      );
    }
  } else {
    baseUrl = body.baseUrl;
    email = body.login?.email ?? process.env.EVIDENCE_EMAIL;
    password = body.login?.password ?? process.env.EVIDENCE_PASSWORD;
    signinPath = body.login?.signinPath ?? "/auth/signin";
    if (!baseUrl) {
      return NextResponse.json({ error: "Falta `app` o `baseUrl`" }, { status: 400 });
    }
  }

  const results: Array<{ path: string; attachmentGid?: string; error?: string }> = [];
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    });
    const page = await browser.newPage();

    // Login opcional (para páginas con sesión).
    if (email && password) {
      await page.goto(`${baseUrl}${signinPath}`, { waitUntil: "networkidle2", timeout: 60000 });
      await page.type('input[type="email"]', email);
      await page.type('input[type="password"]', password);
      // El botón dice "Ingresar" — puppeteer no tiene selector por texto.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /ingresar/i.test(b.textContent || "")
        );
        (btn as HTMLButtonElement | undefined)?.click();
      });
      await page
        .waitForFunction(() => !location.pathname.includes("/auth/signin"), { timeout: 60000 })
        .catch(() => {});
    }

    for (const path of paths) {
      try {
        await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle2", timeout: 60000 });
        await new Promise((r) => setTimeout(r, 1500)); // datos async
        const png = (await page.screenshot({ fullPage: body.fullPage ?? true, type: "png" })) as Buffer;
        const safe = path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
        const att = await attachFile(taskGid, png, `${safe}.png`, "image/png");
        results.push({ path, attachmentGid: att.gid });
      } catch (e) {
        results.push({ path, error: e instanceof Error ? e.message : String(e) });
      }
    }

    if (body.comment) {
      await addComment(taskGid, body.comment);
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Falló la captura", detail: e instanceof Error ? e.message : String(e), results },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  const ok = results.filter((r) => r.attachmentGid).length;
  return NextResponse.json({ success: true, attached: ok, total: paths.length, results });
}
