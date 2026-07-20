"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitEvidence, type EvidenceFormState } from "./actions";
import styles from "./evidencia.module.css";

const ASANA_TASK_URL = "https://app.asana.com/0/0";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {pending ? "Capturando y adjuntando…" : "Capturar y adjuntar"}
    </button>
  );
}

export default function EvidenceForm({ apps }: { apps: string[] }) {
  const [state, formAction] = useActionState<EvidenceFormState, FormData>(
    submitEvidence,
    {}
  );

  return (
    <>
      <form action={formAction} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="app">
            App
          </label>
          <select id="app" name="app" className={styles.select} defaultValue={apps[0]} required>
            {apps.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="taskLink">
            Tarea de Asana <span className={styles.hint}>— pegá el link o el ID</span>
          </label>
          <input
            id="taskLink"
            name="taskLink"
            className={styles.input}
            placeholder="https://app.asana.com/0/…/1234567890"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="paths">
            Pantallas <span className={styles.hint}>— una ruta por línea</span>
          </label>
          <textarea
            id="paths"
            name="paths"
            className={styles.textarea}
            placeholder={"/dashboard/home\n/pedidos?estado=pendiente"}
            required
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Tipo de evidencia</span>
          <div className={styles.segmented}>
            <label className={styles.segment}>
              <input type="radio" name="capture" value="screenshot" defaultChecked />
              Fotos
            </label>
            <label className={styles.segment}>
              <input type="radio" name="capture" value="video" />
              Video
            </label>
            <label className={styles.segment}>
              <input type="radio" name="capture" value="both" />
              Ambos
            </label>
          </div>
        </div>

        <div className={styles.checkRow}>
          <input type="checkbox" id="fullPage" name="fullPage" defaultChecked />
          <label htmlFor="fullPage">Pantalla completa (scroll entero) en las fotos</label>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="comment">
            Comentario <span className={styles.hint}>— opcional</span>
          </label>
          <textarea
            id="comment"
            name="comment"
            className={styles.textarea}
            placeholder="QA: evidencia del flujo X ✓"
          />
        </div>

        <SubmitButton />
      </form>

      {state.error && (
        <div className={styles.result}>
          <span className={styles.resultErr}>✗ {state.error}</span>
        </div>
      )}

      {state.ok && (
        <div className={styles.result}>
          <span className={styles.resultOk}>
            ✓ Adjuntado {state.attached}/{state.total} a la tarea
          </span>
          <ul className={styles.resultList}>
            {state.results?.map((r, i) => (
              <li key={i} className={styles.resultItem}>
                <span className={styles.resultPath}>{r.path}</span>
                {r.attachmentGid ? "✓" : `✗ ${r.error ?? "sin adjuntar"}`}
              </li>
            ))}
          </ul>
          {state.taskGid && (
            <a
              className={styles.taskLink}
              href={`${ASANA_TASK_URL}/${state.taskGid}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir tarea en Asana →
            </a>
          )}
        </div>
      )}
    </>
  );
}
