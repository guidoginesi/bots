import Link from "next/link";
import styles from "./page.module.css";
import LogoutButton from "./reports/LogoutButton";

export default function HomeLanding() {
  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <div>
          <h1>Pow</h1>
          <p>Panel interno</p>
        </div>
        <LogoutButton />
      </header>

      <div className={styles.hubGrid}>
        <Link href="/bots" className={`${styles.card} ${styles.hubCard}`}>
          <span className={styles.hubLabel}>Automatización</span>
          <span className={styles.hubTitle}>Bots</span>
          <p className={styles.cardDesc}>
            Webhooks, Asana y Google Chat.
          </p>
        </Link>

        <Link href="/reports" className={`${styles.card} ${styles.hubCard}`}>
          <span className={styles.hubLabel}>Análisis</span>
          <span className={styles.hubTitle}>Informes</span>
          <p className={styles.cardDesc}>
            CEO Scorecard, CRM Pow/Undo, Markova y más.
          </p>
        </Link>

        <Link href="/evidencia" className={`${styles.card} ${styles.hubCard}`}>
          <span className={styles.hubLabel}>QA</span>
          <span className={styles.hubTitle}>Evidencia</span>
          <p className={styles.cardDesc}>
            Capturas y video de las apps, adjuntados a Asana.
          </p>
        </Link>
      </div>
    </main>
  );
}
