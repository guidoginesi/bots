"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "@/app/page.module.css";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/reports/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "No se pudo iniciar sesión.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginCard}>
      <h1 className={styles.loginTitle}>Acceso</h1>
      <p className={styles.loginLead}>
        Introduce la contraseña para continuar.
      </p>
      <form className={styles.loginForm} onSubmit={onSubmit}>
        <label className={styles.loginLabel} htmlFor="site-password">
          Contraseña
        </label>
        <input
          id="site-password"
          className={styles.loginInput}
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          autoFocus
        />
        <button className={styles.loginBtn} type="submit" disabled={loading}>
          {loading ? "Verificando…" : "Entrar"}
        </button>
        {error && <p className={styles.loginError}>{error}</p>}
      </form>
    </div>
  );
}
