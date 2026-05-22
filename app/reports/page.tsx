import Link from "next/link";
import { loadReportsManifest } from "@/lib/reportsManifest";
import LogoutButton from "./LogoutButton";
import styles from "@/app/page.module.css";

export const dynamic = "force-dynamic";

export default function ReportsIndexPage() {
  const reports = loadReportsManifest();

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <div>
          <h1>Dashboards</h1>
          <p>Informes internos</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/" className={styles.reportsLink}>
            Inicio
          </Link>
          <Link href="/bots" className={styles.reportsLink}>
            Bots
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className={styles.grid}>
        {reports.map((r) => (
          <Link
            key={r.slug}
            href={`/reports/${r.file}?v=20260522`}
            className={`${styles.card} ${styles.reportCard}`}
          >
            <span className={styles.cardName}>{r.title}</span>
            <p className={styles.cardDesc}>{r.description}</p>
          </Link>
        ))}
      </div>

      {reports.length === 0 && (
        <p className={styles.loading}>No hay dashboards publicados.</p>
      )}
    </main>
  );
}
