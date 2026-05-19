"use client";

import styles from "@/app/page.module.css";

export default function LogoutButton() {
  return (
    <button
      type="button"
      className={styles.textBtn}
      onClick={async () => {
        await fetch("/api/reports/auth", { method: "DELETE" });
        window.location.href = "/login";
      }}
    >
      Cerrar sesión
    </button>
  );
}
