"use server";

import {
  runEvidence,
  EvidenceError,
  parseTaskGid,
  type CaptureMode,
  type Step,
} from "@/lib/evidence";

export interface EvidenceFormState {
  ok?: boolean;
  error?: string;
  taskGid?: string;
  attached?: number;
  total?: number;
  results?: Array<{ path: string; attachmentGid?: string; error?: string }>;
}

export async function submitEvidence(
  _prev: EvidenceFormState,
  formData: FormData
): Promise<EvidenceFormState> {
  const app = String(formData.get("app") || "").trim();
  const taskLink = String(formData.get("taskLink") || "").trim();
  const pathsRaw = String(formData.get("paths") || "");
  const stepsRaw = String(formData.get("steps") || "").trim();
  const comment = String(formData.get("comment") || "").trim();
  const capture = (String(formData.get("capture") || "screenshot") as CaptureMode);
  const fullPage = formData.get("fullPage") === "on";

  if (!app) return { error: "Elegí una app." };

  const taskGid = parseTaskGid(taskLink);
  if (!taskGid) return { error: "No pude extraer el ID de la tarea del link de Asana." };

  // Modo recorrido (avanzado): pasos JSON. Tiene prioridad sobre las rutas.
  let steps: Step[] | undefined;
  if (stepsRaw) {
    try {
      const parsed = JSON.parse(stepsRaw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { error: "Los pasos deben ser un array JSON no vacío." };
      }
      steps = parsed as Step[];
    } catch {
      return { error: "Los pasos no son JSON válido. Revisá el formato." };
    }
  }

  const paths = pathsRaw
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("/") ? p : `/${p}`));
  if (!steps && paths.length === 0) {
    return { error: "Indicá al menos una ruta de pantalla, o pasos de recorrido." };
  }

  try {
    const result = await runEvidence({
      app,
      paths: paths.length ? paths : undefined,
      steps,
      taskGid,
      comment: comment || undefined,
      capture,
      fullPage,
    });
    return {
      ok: true,
      taskGid,
      attached: result.attached,
      total: result.total,
      results: result.results,
    };
  } catch (e) {
    if (e instanceof EvidenceError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "Falló la captura." };
  }
}
