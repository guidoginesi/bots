import type { Metadata } from "next";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Evidencia QA — Cómo usarla | Pow",
  description:
    "Cómo capturar screenshots o grabar recorridos de QA de las apps de Pow y adjuntarlos a Asana, por API o desde otra sesión de Claude.",
};

const STEPS_EXAMPLE = `{
  "app": "appadm",
  "taskGid": "1209999999999999",
  "capture": "video",
  "comment": "QA — asignación de owner",
  "steps": [
    { "action": "goto",       "path": "/budget" },
    { "action": "waitFor",    "text": "Budgets de Equipos" },
    { "action": "click",      "selector": "tr:has-text('CX') >> text=Editar" },
    { "action": "select",     "selector": "[name=owner]", "value": "Andrés Acerenza" },
    { "action": "click",      "selector": "button:has-text('Guardar')" },
    { "action": "waitFor",    "text": "Andrés Acerenza" },
    { "action": "screenshot", "name": "owner-asignado" }
  ]
}`;

const CURL = `curl -X POST https://bots-one-zeta.vercel.app/api/evidence \\
  -H "x-evidence-key: $EVIDENCE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "app": "appadm",
    "taskGid": "<gid>",
    "capture": "video",
    "steps": [ /* ... */ ]
  }'`;

const PROMPT_QA = `Leé docs/evidence-tool.md. Quiero grabar un recorrido de QA y adjuntarlo a Asana:
- App: <appadm | hub | …>
- Tarea de Asana: <link de la tarea>
- Funcionalidad a probar: <describí el flujo: entrar a X, clickear Y,
  completar Z, y verificar que aparece W>
Armá los \`steps\`, corré el endpoint en modo video y adjuntá.`;

const PROMPT_SIMPLE = `Leé docs/evidence-tool.md. Sacá screenshots de la app <X>,
pantallas </ruta1>, </ruta2>, y adjuntalas a la tarea de Asana <link>.`;

export default function EvidenceDocsPage() {
  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Pow · Herramienta interna</span>
        <h1>Evidencia QA en Asana</h1>
        <p className={styles.lead}>
          Recorre una app de Pow y adjunta la evidencia a una tarea de Asana:
          screenshots o un <strong>video del recorrido real</strong> de una
          funcionalidad (clicks, formularios, resultado). Corre en la nube; es
          centralizada y multi-app.
        </p>
      </header>

      <section className={styles.section}>
        <h2>Endpoints</h2>
        <ul>
          <li>
            <span className={styles.pill}>Sin comandos</span>
            <a className={styles.link} href="/evidencia">
              /evidencia
            </a>{" "}
            — formulario para el equipo (requiere login de Pow).
          </li>
          <li>
            <span className={styles.pill}>API</span>
            <span className={styles.code}>POST /api/evidence</span> — programático,
            protegido por API key.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Dos modos</h2>
        <ul>
          <li>
            <strong>
              <span className={styles.code}>paths[]</span>
            </strong>{" "}
            — solo navega y saca una foto por pantalla. Para mostrar que una
            pantalla existe/carga.
          </li>
          <li>
            <strong>
              <span className={styles.code}>steps[]</span>
            </strong>{" "}
            — <strong>recorrido de QA</strong>: ejecuta interacciones en orden{" "}
            <strong>mientras graba</strong>, así el video muestra la
            funcionalidad en uso. <span className={styles.muted}>Es lo que se usa para QA de una feature nueva.</span> Tiene prioridad sobre{" "}
            <span className={styles.code}>paths</span>.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>API — cómo consultarla</h2>
        <p>
          <span className={styles.code}>POST /api/evidence</span> con header{" "}
          <span className={styles.code}>x-evidence-key</span> y body JSON:
        </p>
        <pre className={styles.pre}>{CURL}</pre>
        <ul>
          <li>
            <span className={styles.code}>app</span>: clave de la app (resuelve
            credenciales del env <span className={styles.code}>EVIDENCE_&lt;APP&gt;_*</span>).
          </li>
          <li>
            <span className={styles.code}>capture</span>:{" "}
            <span className={styles.code}>&quot;screenshot&quot;</span> (default) |{" "}
            <span className={styles.code}>&quot;video&quot;</span> |{" "}
            <span className={styles.code}>&quot;both&quot;</span>.
          </li>
          <li>
            <span className={styles.code}>taskGid</span>: ID de la tarea de Asana
            (o pegá el link en la página y se extrae solo).
          </li>
          <li>
            <span className={styles.code}>comment</span>,{" "}
            <span className={styles.code}>fullPage</span>,{" "}
            <span className={styles.code}>settleMs</span>: opcionales.
          </li>
        </ul>
        <div className={styles.callout}>
          La <span className={styles.code}>EVIDENCE_API_KEY</span> vive solo en
          Vercel (proyecto <span className={styles.code}>bots</span> → Settings →
          Environment Variables). Para no manejar la key, usá la página{" "}
          <span className={styles.code}>/evidencia</span>, que la inyecta del lado
          del servidor.
        </div>
      </section>

      <section className={styles.section}>
        <h2>Recorrido de QA — formato de <span className={styles.code}>steps</span></h2>
        <pre className={styles.pre}>{STEPS_EXAMPLE}</pre>
        <p className={styles.muted}>
          Acciones: <span className={styles.code}>goto</span>,{" "}
          <span className={styles.code}>click</span>,{" "}
          <span className={styles.code}>fill</span>,{" "}
          <span className={styles.code}>select</span>,{" "}
          <span className={styles.code}>hover</span>,{" "}
          <span className={styles.code}>press</span>,{" "}
          <span className={styles.code}>waitFor</span> (text | selector | ms),{" "}
          <span className={styles.code}>scroll</span>,{" "}
          <span className={styles.code}>screenshot</span>. Los selectores usan
          sintaxis de Playwright (<span className={styles.code}>text=</span>,{" "}
          <span className={styles.code}>:has-text()</span>,{" "}
          <span className={styles.code}>&gt;&gt;</span>). Si un paso falla, se corta
          el recorrido pero igual se adjunta el video (para ver dónde) y se reporta
          el error.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Desde otra sesión de Claude</h2>
        <p>
          En una sesión de Claude Code parada en el repo{" "}
          <span className={styles.code}>bots</span>:
        </p>
        <h3>Recorrido de QA (video)</h3>
        <pre className={styles.pre}>{PROMPT_QA}</pre>
        <h3>Modo simple (fotos)</h3>
        <pre className={styles.pre}>{PROMPT_SIMPLE}</pre>
      </section>

      <section className={styles.section}>
        <h2>Sumar una app nueva</h2>
        <p>
          No hace falta tocar código en la otra app — el endpoint es centralizado.
          Cargá en Vercel (proyecto <span className={styles.code}>bots</span>,
          Production):
        </p>
        <pre className={styles.pre}>{`EVIDENCE_<APP>_BASEURL
EVIDENCE_<APP>_EMAIL
EVIDENCE_<APP>_PASSWORD
EVIDENCE_<APP>_SIGNIN_PATH   (opcional, default /auth/signin)`}</pre>
        <p className={styles.muted}>
          La app aparece sola en el dropdown de{" "}
          <span className={styles.code}>/evidencia</span>. El login asume el UI de
          Pow (input email/password + botón &quot;Ingresar&quot;).
        </p>
      </section>

      <footer className={styles.footer}>
        Documentación de referencia en el repo:{" "}
        <span className={styles.code}>docs/evidence-tool.md</span>. Núcleo:{" "}
        <span className={styles.code}>lib/evidence.ts</span>.
      </footer>
    </main>
  );
}
