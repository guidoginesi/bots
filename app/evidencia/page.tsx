import Link from "next/link";
import { listConfiguredApps } from "@/lib/evidence";
import EvidenceForm from "./EvidenceForm";
import styles from "./evidencia.module.css";

export const dynamic = "force-dynamic";

export default function EvidenciaPage() {
  const apps = listConfiguredApps();

  return (
    <main className={styles.layout}>
      <nav className={styles.breadcrumb}>
        <Link href="/">Pow</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbHere}>Evidencia QA</span>
      </nav>

      <header className={styles.header}>
        <h1>Evidencia QA</h1>
        <p>
          Capturá pantallas (o grabá un video del recorrido) de una app y
          adjuntalas automáticamente a una tarea de Asana.
        </p>
      </header>

      <div className={styles.card}>
        {apps.length === 0 ? (
          <p className={styles.empty}>
            No hay apps configuradas todavía. Cargá en Vercel las variables{" "}
            <code>EVIDENCE_&lt;APP&gt;_BASEURL</code>,{" "}
            <code>EVIDENCE_&lt;APP&gt;_EMAIL</code> y{" "}
            <code>EVIDENCE_&lt;APP&gt;_PASSWORD</code> para que aparezcan acá.
          </p>
        ) : (
          <EvidenceForm apps={apps} />
        )}
      </div>
    </main>
  );
}
