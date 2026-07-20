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
 *   Body:    { baseUrl, paths: string[], taskGid, comment?, fullPage?, login? }
 *
 * Login (opcional): si EVIDENCE_EMAIL/EVIDENCE_PASSWORD está en el env (o se pasa
 * `login`), completa el formulario /auth/signin de la app target antes de
 * capturar (para páginas con sesión). Los secretos SIEMPRE vienen del env.
 */

interface Body {
  baseUrl: string;
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
  const { baseUrl, paths, taskGid } = body;
  if (!baseUrl || !Array.isArray(paths) || paths.length === 0 || !taskGid) {
    return NextResponse.json({ error: "Faltan baseUrl, paths[] o taskGid" }, { status: 400 });
  }

  const email = body.login?.email ?? process.env.EVIDENCE_EMAIL;
  const password = body.login?.password ?? process.env.EVIDENCE_PASSWORD;
  const signinPath = body.login?.signinPath ?? "/auth/signin";

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
