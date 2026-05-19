"use client";

import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import styles from "@/app/page.module.css";

export default function LoginPage() {
  return (
    <main className={styles.loginWrap}>
      <Suspense
        fallback={
          <div className={styles.loginCard}>
            <p className={styles.loading}>Cargando…</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
