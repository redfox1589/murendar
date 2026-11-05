-- Мурендарь: таблица пользователей + поминутный планировщик пушей

create table if not exists public.murendar_users (
  id text primary key,                -- sha256-hex кода синхронизации
  tasks jsonb not null default '[]'::jsonb,
  subs jsonb not null default '[]'::jsonb,
  tz text,
  updated_at bigint not null default 0,
  fired jsonb not null default '{}'::jsonb
);

-- Доступ только через service role (edge-функции); anon-ключ таблицу не видит
alter table public.murendar_users enable row level security;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Поминутный вызов scheduler-функции
select cron.schedule(
  'murendar-push-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hvesduszevnjtygnrqhh.supabase.co/functions/v1/scheduler',
    headers := '{"Content-Type": "application/json", "X-Cron-Secret": "7b4cd93e1744192029773d0a4f4b0820fe60c8c11abad1c3"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
