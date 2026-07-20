# Evidence tool — `/api/evidence` + página `/evidencia`

Herramienta para **adjuntar evidencia gráfica (screenshots y/o video) a tareas de Asana** automáticamente, para QA, sirviendo para varias apps.

## Qué hace
Entra a una app (se loguea si hace falta), recorre una o más pantallas con un Chromium serverless y **adjunta la evidencia** a una tarea de Asana (+ comentario). Corre en la nube, no depende de ninguna máquina local. La evidencia puede ser:
- **`screenshot`** (default): una PNG por cada ruta.
- **`video`**: un `.webm` del recorrido por todas las rutas (grabación nativa de Playwright, sin ffmpeg).
- **`both`**: video del recorrido + una PNG por ruta.

## Dos formas de usarla
1. **Página `/evidencia`** (equipo, sin comandos): detrás del login de `bots`. Dropdown de app (se autopopula de las env configuradas), link de la tarea de Asana (se extrae el gid), rutas (una por línea), tipo de evidencia (Fotos/Video/Ambos), pantalla completa y comentario. Llama a la lógica **del lado del servidor**, así el usuario nunca ve la API key.
2. **`POST /api/evidence`** (programático): protegido por API key.
```bash
curl -X POST https://bots-one-zeta.vercel.app/api/evidence \
  -H "x-evidence-key: <EVIDENCE_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "app":"hub", "paths":["/dashboard/home?as=Jaromezuk"], "taskGid":"<gid>", "capture":"both", "comment":"...", "fullPage":true }'
```
- **`app`**: clave que resuelve del env `EVIDENCE_<APP>_BASEURL / _EMAIL / _PASSWORD / _SIGNIN_PATH` (multi-app).
- **`capture`**: `"screenshot"` (default) | `"video"` | `"both"`.
- **`baseUrl`** (opcional): overridea la URL de la app manteniendo sus credenciales (útil para capturar un **preview**).
- **Usar el dominio de PRODUCCIÓN público** (`https://bots-one-zeta.vercel.app` o `https://bots-guido-ginesi-pow.vercel.app`). Las URLs de deploy con hash (`bots-XXXX.vercel.app`) están detrás del **SSO de Vercel (Deployment Protection)**.

## Recorrido de QA (`steps`) — que el video muestre la funcionalidad en uso
`paths[]` solo **navega** (el video queda como pase de pantallas cargando). Para un QA real —entrar, hacer la acción, ver el resultado— se pasa `steps[]`: el bot ejecuta las interacciones **en orden mientras graba**. `steps` tiene prioridad sobre `paths`.

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
Acciones: `goto` (path), `click`/`hover` (selector), `fill` (selector+value, anti-hidratación), `select` (selector+value, por value o label), `press` (key), `waitFor` (text | selector | ms), `scroll` (to top/bottom | selector), `screenshot` (name?, fullPage?). `selector` acepta la sintaxis de Playwright (`text=`, `:has-text()`, `>>`). `settleMs` (default 700) es la pausa tras cada paso para que el video sea legible. Si un paso falla, se **corta** el recorrido pero **igual se adjunta el video** (para ver dónde falló) y se reporta el error.

En la página `/evidencia` hay un textarea **"Recorrido de QA"** para pegar ese JSON de `steps` (modo avanzado).

## Archivos
- `lib/evidence.ts` — **núcleo** compartido: `runEvidence()` (login + recorrido + screenshot/video + attach), `listConfiguredApps()`, `parseTaskGid()`. Usa `playwright-core` + `@sparticuz/chromium`.
- `app/api/evidence/route.ts` — endpoint HTTP fino (auth por API key → `runEvidence`).
- `app/evidencia/` — página del equipo: `page.tsx` (server, lista apps), `EvidenceForm.tsx` (form cliente), `actions.ts` (server action), `evidencia.module.css`.
- `lib/asana.ts` — `addComment()` y `attachFile()` (multipart, usa `ASANA_PAT`; acepta cualquier mimeType, incluye video).
- `next.config.ts` — `serverExternalPackages` + `outputFileTracingIncludes` (incluye chromium **y playwright-core** en la función).
- `vercel.json` — `functions[/api/evidence]`: `memory: 1024`, `maxDuration: 300`.

## Env (Vercel, Production)
- `ASANA_PAT` — token del usuario service de Asana (para adjuntar/comentar).
- `EVIDENCE_API_KEY` — protege el endpoint (header `x-evidence-key`).
- Por app: `EVIDENCE_HUB_BASEURL`, `EVIDENCE_HUB_EMAIL`, `EVIDENCE_HUB_PASSWORD` (el usuario de login debe ser **ADMIN/PO** si se usa `?as=` en el Hub). Sumar `EVIDENCE_<APP>_*` para más apps.

## Estado (jul 2026)
- **Screenshots**: deployado y **funcionando en producción**, validado end-to-end (Hub: login + captura + adjunto a Asana).
- **Video** (`playwright-core`) y **página `/evidencia`**: implementados; **falta validar el video end-to-end en producción** (ver notas).

## Cómo sumar una app (multi-app)
1. Cargar en Vercel (Production): `EVIDENCE_<APP>_BASEURL`, `EVIDENCE_<APP>_EMAIL`, `EVIDENCE_<APP>_PASSWORD` (y `EVIDENCE_<APP>_SIGNIN_PATH` si no es `/auth/signin`).
2. Listo: la app aparece sola en el dropdown de `/evidencia` (se autopopula escaneando `EVIDENCE_*_BASEURL`).
3. El login del usuario debe tener permisos para lo que se quiera capturar (ADMIN/PO si se usa `?as=` en el Hub).

## Notas / troubleshooting
- Si la captura falla en Vercel: revisar `outputFileTracingIncludes` (chromium + playwright-core) y la `memory` de la función (1024).
- **Video → ffmpeg**: Playwright graba con un binario **ffmpeg propio** (aparte del browser). Como usamos el chromium de `@sparticuz`, el `build` lo instala dentro de `node_modules` con `PLAYWRIGHT_BROWSERS_PATH=0` (entra al bundle por el glob de `playwright-core`) y en runtime la env `PLAYWRIGHT_BROWSERS_PATH=0` (seteada en Vercel) hace que Playwright lo resuelva ahí. Si el video vuelve a fallar por "ffmpeg", revisar que el build corra el `playwright ... install ffmpeg`, que la env exista en runtime, y el `chmod` defensivo en `lib/evidence.ts` (el tracing puede perder el bit +x).
- **Video (peso)**: la grabación es más pesada (CPU/RAM) y más lenta que las fotos. En Fluid Compute la `memory` de `vercel.json` se ignora (hay headroom por default). Si el `.webm` sale vacío o la función muere, acortar el recorrido y vigilar `maxDuration: 300`.
- Si una app usa un formulario de login distinto (otro botón, SSO, otros campos), hoy el login asume el POW UI (`input[type=email]`, `input[type=password]`, botón "Ingresar"). Para soportarlo hay que hacer los selectores configurables por app.
