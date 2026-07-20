import { NextRequest, NextResponse } from "next/server";
import { runEvidence, EvidenceError, type EvidenceInput } from "@/lib/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Endpoint HTTP de la herramienta de evidencia. Protegido por API key
 * (header x-evidence-key). La lógica de captura vive en `lib/evidence.ts` y la
 * comparte con la página `/evidencia`.
 *
 * POST /api/evidence
 *   Header:  x-evidence-key: <EVIDENCE_API_KEY>
 *   Body:    { app, taskGid, comment?, fullPage?, capture?, settleMs?,
 *              paths?: string[],   // recorrido simple: navega y captura cada ruta
 *              steps?: Step[] }    // recorrido de QA: interacciones grabadas
 *            capture: "screenshot" (default) | "video" | "both"
 *            Si viene `steps`, ejecuta el recorrido (click/fill/select/waitFor/...)
 *            mientras graba, para que el video muestre la funcionalidad en uso.
 */

export async function POST(request: NextRequest) {
  const apiKey = process.env.EVIDENCE_API_KEY;
  if (apiKey && request.headers.get("x-evidence-key") !== apiKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: EvidenceInput;
  try {
    body = (await request.json()) as EvidenceInput;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    const result = await runEvidence(body);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof EvidenceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: "Falló la captura", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
