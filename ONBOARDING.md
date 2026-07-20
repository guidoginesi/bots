# Evidencia QA en Asana — cómo usar la herramienta

Este repo (`bots`) tiene una herramienta que **recorre una app de Pow y adjunta evidencia a una tarea de Asana** para QA: screenshots y/o un **video del recorrido real** (con clicks, formularios, etc.). Corre en la nube (Chromium serverless), no depende de ninguna máquina local. El endpoint es **centralizado y multi-app**.

**Doc completa:** `docs/evidence-tool.md` (leela para el detalle).

## Producción
- Página (equipo, sin comandos): https://bots-one-zeta.vercel.app/evidencia
- Endpoint (programático): `POST https://bots-one-zeta.vercel.app/api/evidence`

## Dos modos
- **`paths[]`** — solo navega y saca una foto por pantalla. Rápido para "mostrar que la pantalla existe/carga".
- **`steps[]`** — **recorrido de QA**: el bot ejecuta interacciones en orden **mientras graba**, así el video muestra la funcionalidad en uso (entrar → hacer la acción → ver el resultado). `steps` tiene prioridad sobre `paths`. **Esto es lo que hay que usar para el QA de una funcionalidad nueva.**

## Instrucciones listas para pegar

**Recorrido de QA (video de la funcionalidad en uso)** — pegá esto en Claude Code parado en el repo `bots`:
```
Leé docs/evidence-tool.md. Quiero grabar un recorrido de QA y adjuntarlo a Asana:
- App: <appadm | hub | …>
- Tarea de Asana: <link de la tarea>
- Funcionalidad a probar: <describí el flujo en palabras: entrar a X,
  clickear Y, completar Z, y verificar que aparece W>
Armá los `steps`, corré el endpoint en modo video y adjuntá.
```
Claude arma los `steps` a partir de la descripción (conoce el DOM si trabajás en esa app), corre la herramienta y adjunta el video + screenshot del resultado.

**Modo simple (solo fotos de pantallas, sin interacción):**
```
Leé docs/evidence-tool.md. Sacá screenshots de la app <X>, pantallas
</ruta1>, </ruta2>, y adjuntalas a la tarea de Asana <link>.
```

**Sin comandos (para el equipo):** https://bots-one-zeta.vercel.app/evidencia — dropdown de app, link de Asana, y el textarea "Recorrido de QA" para pegar los `steps`.

## Formato de `steps`
```json
{
  "app": "appadm", "taskGid": "…", "capture": "video",
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
}
```
Acciones: `goto`, `click`, `fill`, `select`, `hover`, `press`, `waitFor` (text | selector | ms), `scroll`, `screenshot`. `selector` usa sintaxis de Playwright (`text=`, `:has-text()`, `>>`). Si un paso falla, se corta el recorrido pero **igual se adjunta el video** (para ver dónde) y se reporta el error.

## Endpoint (curl)
```bash
curl -X POST https://bots-one-zeta.vercel.app/api/evidence \
  -H "x-evidence-key: $EVIDENCE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "app":"appadm", "taskGid":"<gid>", "capture":"video", "steps":[ … ] }'
```
- `capture`: `"screenshot"` (default) | `"video"` | `"both"`.
- La **API key NO está en local**: bajala con `vercel env pull` o tomala de Vercel → proyecto `bots` → Settings → Environment Variables (`EVIDENCE_API_KEY`). Para no usar key, usá la página `/evidencia` (tiene un textarea "Recorrido de QA" para pegar los `steps`).

## Sumar una app nueva (target)
No hace falta tocar código en la otra app — el endpoint es centralizado. Cargá en Vercel (proyecto `bots`, Production):
```
EVIDENCE_<APP>_BASEURL
EVIDENCE_<APP>_EMAIL
EVIDENCE_<APP>_PASSWORD
EVIDENCE_<APP>_SIGNIN_PATH   (opcional, default /auth/signin)
```
La app aparece sola en el dropdown de `/evidencia`. El login asume el UI de POW (`input[type=email]`, `input[type=password]`, botón "Ingresar"); apps con otro formulario necesitan ajustar los selectores.

## Archivos clave
- `lib/evidence.ts` — núcleo: `runEvidence()`, tipo `Step`, `listConfiguredApps()`, `parseTaskGid()` (playwright-core + @sparticuz/chromium).
- `app/api/evidence/route.ts` — endpoint (auth por API key).
- `app/evidencia/` — página del equipo (form + server action).
- `lib/asana.ts` — adjuntar/comentar (usa `ASANA_PAT`).
