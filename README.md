# bots

Automatización **Asana → Google Chat** para el Directorio.

Detecta comentarios con `#dir` o `@PowBoardBot` en proyectos de Asana y los reenvía al Space del Directorio vía Incoming Webhook, agrupados por tarea (threading).

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Next.js 15 (App Router) en Vercel |
| Base de datos | Supabase (Postgres) |
| Asana | REST API v1 + Webhooks |
| Chat | Google Chat Incoming Webhook |

---

## Setup

### 1. Variables de entorno

```bash
cp .env.example .env.local
```

Completar todos los valores en `.env.local`.

| Variable | Descripción |
|----------|-------------|
| `ASANA_PAT` | Personal Access Token del usuario service |
| `ASANA_PROJECT_GIDS` | GIDs de proyectos separados por coma |
| `ASANA_WEBHOOK_TARGET_URL` | URL pública del endpoint (`https://…/api/asana/webhook`) |
| `GC_WEBHOOK_URL` | Incoming Webhook del space del Directorio |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo en servidor) |
| `FORWARD_TAGS` | Tags que disparan reenvío (default: `#dir,@PowBoardBot`) |

### 2. Base de datos

Ejecutar la migración en el SQL Editor de Supabase:

```sql
-- supabase/migrations/001_initial.sql
```

### 3. Deploy en Vercel

```bash
vercel deploy --prod
```

Agregar las variables de entorno en el dashboard de Vercel.

### 4. Registrar webhook en Asana

```bash
npm install
npm run register-webhook
```

Asana hará el handshake automáticamente al endpoint. Verificar que `hook_secret` quede guardado en la tabla `asana_webhook_config`.

---

## Flujo

```
Asana evento
    └─ POST /api/asana/webhook
         ├─ Handshake (X-Hook-Secret) → guarda secret en DB, responde 204
         └─ Evento normal
              ├─ Verifica HMAC (X-Hook-Signature)
              ├─ Extrae task_gids únicos
              ├─ Fetchea task info + stories (comments)
              ├─ Filtra por FORWARD_TAGS
              ├─ Deduplica por story_gid
              ├─ Envía a Google Chat (threadKey = asana-task-<gid>)
              └─ Registra en asana_message_log
```

---

## Estructura

```
app/
  api/asana/webhook/route.ts   # Handler principal
lib/
  asana.ts                     # Cliente Asana API
  chat.ts                      # Envío a Google Chat
  supabaseAdmin.ts             # Cliente Supabase service role
  text.ts                      # stripTags / containsAnyTag
scripts/
  registerAsanaWebhook.ts      # Registro de webhooks en Asana
supabase/
  migrations/001_initial.sql   # Tablas y índices
```

---

## Tablas en Supabase

| Tabla | Propósito |
|-------|-----------|
| `asana_webhook_config` | Config por proyecto + hook_secret |
| `asana_processed_stories` | Deduplicación (PK = story_gid) |
| `asana_message_log` | Audit log completo de mensajes |

---

## Informes HTML internos (`/reports`)

Dashboards estáticos (CEO Scorecard, etc.) servidos desde el mismo deploy de Vercel, con **contraseña en servidor** (no embebida en el HTML).

### Publicar / actualizar un informe

1. Editá el HTML en `app-directorio` (u otra ruta).
2. Registrá la fuente en `scripts/sync-reports.mjs` (`SOURCES`).
3. Desde `bots`:

```bash
npm run sync-reports
```

4. Commit de `public/reports/` y deploy.

### Variables en Vercel

| Variable | Descripción |
|----------|-------------|
| `REPORTS_PASSWORD` | Contraseña compartida para el equipo |
| `REPORTS_AUTH_SECRET` | Opcional — refuerza la cookie de sesión |

### URLs

| Ruta | Uso |
|------|-----|
| `/reports` | Índice de informes |
| `/reports/login` | Login |
| `/reports/ceo-scorecard.html` | Ejemplo: CEO Scorecard |
| `/reports/crm-dashboard.html` | CRM + Funnel · datos desde HubSpot |

El script `sync-reports` **elimina el login JavaScript del HTML**; la protección real es middleware + cookie `httpOnly`.

### CRM Dashboard (HubSpot)

- API: `GET /api/hubspot/deals` (requiere sesión de `/reports` o cron de Vercel)
- Cache CDN: **1 hora** · cron **diario** (13:00 UTC) precalienta la API (límite plan Hobby)
- Variables: `HUBSPOT_TOKEN` (+ scopes `deals.read`, `line_items.read`, `contacts.read`)
- El HTML vive en `public/reports/crm-dashboard.html` (editar ahí o copiar desde `pow-dashboard`)

---

## Definition of Done

- [ ] Webhook activo — `hook_secret` guardado en DB
- [ ] Comentario con `#dir` en Asana → mensaje en Chat < 1 min
- [ ] Sin duplicados por reintentos
- [ ] Logs en Supabase con status/errores
- [ ] Thread por tarea (`threadKey` estable)
