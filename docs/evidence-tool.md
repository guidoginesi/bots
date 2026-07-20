# Evidence tool — `/api/evidence`

Herramienta para **adjuntar screenshots (evidencia gráfica) a tareas de Asana** automáticamente, sirviendo para varias apps.

## Qué hace
`POST /api/evidence`: entra a una app (se loguea si hace falta), **captura** pantallas con un Chromium serverless y las **adjunta** a una tarea de Asana (+ comentario). La captura corre en la nube, no depende de ninguna máquina local.

## Cómo se llama
```bash
curl -X POST https://bots-one-zeta.vercel.app/api/evidence \
  -H "x-evidence-key: <EVIDENCE_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "app":"hub", "paths":["/dashboard/home?as=Jaromezuk"], "taskGid":"<gid>", "comment":"...", "fullPage":true }'
```
- **`app`**: clave que resuelve del env `EVIDENCE_<APP>_BASEURL / _EMAIL / _PASSWORD / _SIGNIN_PATH` (multi-app).
- **`baseUrl`** (opcional): overridea la URL de la app manteniendo sus credenciales (útil para capturar un **preview**).
- **Usar el dominio de PRODUCCIÓN público** (`https://bots-one-zeta.vercel.app` o `https://bots-guido-ginesi-pow.vercel.app`). Las URLs de deploy con hash (`bots-XXXX.vercel.app`) están detrás del **SSO de Vercel (Deployment Protection)**.

## Archivos
- `app/api/evidence/route.ts` — endpoint (`puppeteer-core` + `@sparticuz/chromium`, login por formulario, screenshot, attach).
- `lib/asana.ts` — `addComment()` y `attachFile()` (multipart, usa `ASANA_PAT`).
- `next.config.ts` — `serverExternalPackages` + `outputFileTracingIncludes` (incluye el binario de chromium en la función).
- `vercel.json` — `functions[/api/evidence]`: `memory: 1024`, `maxDuration: 300`.

## Env (Vercel, Production)
- `ASANA_PAT` — token del usuario service de Asana (para adjuntar/comentar).
- `EVIDENCE_API_KEY` — protege el endpoint (header `x-evidence-key`).
- Por app: `EVIDENCE_HUB_BASEURL`, `EVIDENCE_HUB_EMAIL`, `EVIDENCE_HUB_PASSWORD` (el usuario de login debe ser **ADMIN/PO** si se usa `?as=` en el Hub). Sumar `EVIDENCE_<APP>_*` para más apps.

## Estado (jul 2026)
Deployado y **funcionando en producción**. Multi-app y protegido con API key. Validado end-to-end (Hub: login + captura + adjunto a Asana).

## Próximo paso (pendiente) — página con formulario
Que cualquiera del equipo lo use **sin comandos**, detrás del login de `bots`:
- Nueva página (ej. `/evidencia`) con: **dropdown de App**, **ruta(s) de pantalla** (o presets), **link de la tarea de Asana** (extraer el gid del link), **comentario**, check **"pantalla completa"**, y botón **"Capturar y adjuntar"**.
- La página llama a `/api/evidence` **del lado del servidor**, inyectando `EVIDENCE_API_KEY` desde el env → el usuario **nunca ve ni escribe la clave**.
- Reusa el `middleware.ts` / `app/login` existentes para el gating.
- Mostrar el resultado (adjuntado ✓ + link a la tarea) o el error.

## Notas / troubleshooting
- Si la captura falla en Vercel: revisar `outputFileTracingIncludes` (binario de chromium) y la `memory` de la función (1024).
- Si una app usa un formulario de login distinto, hacer configurables los selectores por app (hoy asume el POW UI: `input[type=email]`, `input[type=password]`, botón "Ingresar").
