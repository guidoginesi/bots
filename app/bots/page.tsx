"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/page.module.css";
import BotLogs from "@/app/BotLogs";
import LogoutButton from "@/app/reports/LogoutButton";

interface Bot {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  connected: boolean;
  projectCount: number;
  tags?: string;
}

export default function BotsDashboard() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetchBots();
  }, []);

  async function fetchBots() {
    try {
      const res = await fetch("/api/bots");
      if (!res.ok) throw new Error("Error cargando bots");
      setBots(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(bot: Bot) {
    setToggling(bot.id);
    try {
      const res = await fetch(`/api/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !bot.enabled }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      setBots((prev) =>
        prev.map((b) => (b.id === bot.id ? { ...b, enabled: !b.enabled } : b))
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setToggling(null);
    }
  }

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <div>
          <h1>Bots</h1>
          <p>Administración de automatizaciones internas</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/" className={styles.reportsLink}>
            Inicio
          </Link>
          <Link href="/reports" className={styles.reportsLink}>
            Informes
          </Link>
          <LogoutButton />
        </div>
      </header>

      {loading && <p className={styles.loading}>Cargando…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <div className={styles.grid}>
          {bots.map((bot) => (
            <div key={bot.id} className={styles.card}>
              <div className={styles.cardRow}>
                <div className={styles.cardInfo}>
                  <div className={styles.cardTop}>
                    <span className={styles.cardName}>{bot.name}</span>
                    <span
                      className={`${styles.badge} ${
                        bot.enabled ? styles.badgeOn : styles.badgeOff
                      }`}
                    >
                      {bot.enabled ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className={styles.cardDesc}>{bot.description}</p>
                  <div className={styles.cardMeta}>
                    <span>
                      <span
                        className={`${styles.dot} ${
                          bot.connected ? styles.dotGreen : styles.dotGray
                        }`}
                      />
                      {bot.connected ? "Conectado" : "Sin handshake"}
                    </span>
                    {bot.projectCount > 0 && (
                      <span>
                        {bot.projectCount} proyecto
                        {bot.projectCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {bot.tags && <span>Tags: {bot.tags}</span>}
                  </div>
                </div>
                <label
                  className={styles.toggle}
                  title={bot.enabled ? "Desactivar" : "Activar"}
                >
                  <input
                    type="checkbox"
                    checked={bot.enabled}
                    disabled={toggling === bot.id}
                    onChange={() => handleToggle(bot)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>
              <BotLogs botId={bot.id} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
