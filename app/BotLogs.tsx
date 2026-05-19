"use client";

import { useState } from "react";
import styles from "./logs.module.css";

interface LogEntry {
  id: number;
  task_gid: string;
  story_gid: string;
  author_name: string | null;
  comment_text: string | null;
  forwarded: boolean;
  forwarded_at: string | null;
  chat_response_status: number | null;
  error: string | null;
  created_at: string;
}

interface Props {
  botId: string;
}

export default function BotLogs({ botId }: Props) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function toggle() {
    if (!open && !fetched) {
      setLoading(true);
      try {
        const res = await fetch(`/api/bots/${botId}/logs?limit=20`);
        if (res.ok) setLogs(await res.json());
      } finally {
        setLoading(false);
        setFetched(true);
      }
    }
    setOpen((v) => !v);
  }

  function fmt(ts: string) {
    return new Date(ts).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <div className={styles.section}>
      <button className={styles.toggleBtn} onClick={toggle}>
        <span className={`${styles.arrow} ${open ? styles.arrowOpen : ""}`}>▶</span>
        Logs recientes
      </button>

      {open && (
        <>
          {loading && <p className={styles.loadingLogs}>Cargando logs…</p>}

          {!loading && logs.length === 0 && (
            <p className={styles.empty}>Sin registros aún.</p>
          )}

          {!loading && logs.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Autor</th>
                  <th>Comentario</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className={styles.muted} style={{ whiteSpace: "nowrap" }}>
                      {fmt(log.created_at)}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {log.author_name ?? "—"}
                    </td>
                    <td>
                      <span className={styles.truncate} title={log.comment_text ?? ""}>
                        {log.comment_text || <span className={styles.muted}>—</span>}
                      </span>
                    </td>
                    <td>
                      {log.error ? (
                        <span
                          className={`${styles.pill} ${styles.pillErr}`}
                          title={log.error}
                        >
                          Error
                        </span>
                      ) : log.forwarded ? (
                        <span className={`${styles.pill} ${styles.pillOk}`}>
                          Enviado
                        </span>
                      ) : (
                        <span className={`${styles.pill} ${styles.pillSkip}`}>
                          Ignorado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
