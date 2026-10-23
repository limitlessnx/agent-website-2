begin;

create table if not exists public.whatsapp_webhook_event_logs (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  event_type text not null,
  organization_id uuid,
  provider_message_id text,
  http_status integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_webhook_event_logs_created_at_idx
  on public.whatsapp_webhook_event_logs (created_at desc);
create index if not exists whatsapp_webhook_event_logs_event_type_idx
  on public.whatsapp_webhook_event_logs (event_type, created_at desc);
create index if not exists whatsapp_webhook_event_logs_request_id_idx
  on public.whatsapp_webhook_event_logs (request_id);

alter table public.whatsapp_webhook_event_logs enable row level security;
revoke all on public.whatsapp_webhook_event_logs from anon, authenticated;
grant all on public.whatsapp_webhook_event_logs to service_role;

commit;
