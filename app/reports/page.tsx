import Link from "next/link";
import { loadReportsManifest } from "@/lib/reportsManifest";
import LogoutButton from "./LogoutButton";
import styles from "@/app/page.module.css";

export const dynamic = "force-dynamic";

export default function ReportsIndexPage() {
  const reports = loadReportsManifest();

  return (
    <main className={styles.layout}>
      <nav className={styles.breadcrumb} aria-label="Navegación">
        <Link href="/">Pow</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbHere}>Informes</span>
      </nav>

      <header className={styles.header}>
        <div>
          <h1>Informes</h1>
          <p>Dashboards internos</p>
        </div>
        <div className={styles.headerActions}>
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
            href={`/reports/${r.file}`}
            className={`${styles.card} ${styles.reportCard}`}
          >
            <span className={styles.cardName}>{r.title}</span>
            <p className={styles.cardDesc}>{r.description}</p>
          </Link>
        ))}
      </div>

      {reports.length === 0 && (
        <p className={styles.loading}>No hay informes publicados.</p>
      )}
    </main>
  );
}
