-- Asana webhook configuration per project
create table if not exists asana_webhook_config (
  id          bigserial primary key,
  project_gid text        not null unique,
  is_enabled  boolean     not null default true,
  hook_secret text        null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Automatically update updated_at on every row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_asana_webhook_config_updated_at
  before update on asana_webhook_config
  for each row execute procedure set_updated_at();

-- Deduplication table: one row per processed story
create table if not exists asana_processed_stories (
  story_gid    text        primary key,
  task_gid     text        not null,
  processed_at timestamptz not null default now()
);

-- Full audit log of every processed comment
create table if not exists asana_message_log (
  id                   bigserial   primary key,
  project_gid          text        not null,
  task_gid             text        not null,
  story_gid            text        not null,
  author_name          text        null,
  comment_text         text        null,
  forwarded            boolean     not null default false,
  forwarded_at         timestamptz null,
  chat_thread_key      text        null,
  chat_response_status int         null,
  error                text        null,
  raw_payload          jsonb       null,
  created_at           timestamptz not null default now()
);

create index if not exists idx_asana_message_log_task  on asana_message_log(task_gid);
create index if not exists idx_asana_message_log_story on asana_message_log(story_gid);
