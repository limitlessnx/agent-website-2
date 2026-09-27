create extension if not exists pgcrypto;

create table if not exists public.gencouv_email_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  sender_name text not null default 'Gencouv',
  sender_email text not null,
  reply_to_email text,
  daily_limit integer not null default 10 check (daily_limit between 1 and 1000),
  resend_domain text not null default 'gencouv.com',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gencouv_email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.gencouv_email_sequences(id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  name text not null,
  subject text not null,
  preview_text text,
  html_body text not null,
  text_body text not null,
  delay_minutes integer not null default 0 check (delay_minutes >= 0),
  resend_template_id text,
  resend_template_alias text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sequence_id, step_order)
);

create table if not exists public.gencouv_email_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence_id uuid references public.gencouv_email_sequences(id) on delete set null,
  sequence_step_id uuid references public.gencouv_email_sequence_steps(id) on delete set null,
  lead_id text,
  recipient_email text not null,
  recipient_name text,
  provider text not null default 'resend',
  provider_email_id text unique,
  provider_message_id text,
  subject text not null,
  status text not null default 'queued',
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  failed_at timestamptz,
  suppressed_at timestamptz,
  last_event_at timestamptz,
  error_code text,
  error_message text,
  tags jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gencouv_email_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_message_id uuid references public.gencouv_email_messages(id) on delete set null,
  provider text not null default 'resend',
  provider_event_id text,
  provider_email_id text,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create table if not exists public.gencouv_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (source in ('google_sheets','resend','n8n','dashboard')),
  direction text not null check (direction in ('inbound','outbound','bidirectional')),
  status text not null default 'running' check (status in ('running','completed','failed','partial')),
  records_read integer not null default 0,
  records_written integer not null default 0,
  records_failed integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.gencouv_external_record_map (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  external_record_id text not null,
  local_entity_type text not null,
  local_entity_id text not null,
  source_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  payload_hash text,
  metadata jsonb not null default '{}'::jsonb,
  unique(organization_id, source, external_record_id, local_entity_type)
);

create index if not exists idx_gencouv_messages_org_created on public.gencouv_email_messages(organization_id, created_at desc);
create index if not exists idx_gencouv_messages_status on public.gencouv_email_messages(organization_id, status);
create index if not exists idx_gencouv_messages_provider_id on public.gencouv_email_messages(provider_email_id);
create index if not exists idx_gencouv_events_org_time on public.gencouv_email_events(organization_id, occurred_at desc);
create index if not exists idx_gencouv_events_type on public.gencouv_email_events(organization_id, event_type);
create index if not exists idx_gencouv_steps_sequence on public.gencouv_email_sequence_steps(sequence_id, step_order);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_gencouv_sequences_updated_at on public.gencouv_email_sequences;
create trigger trg_gencouv_sequences_updated_at before update on public.gencouv_email_sequences for each row execute function public.set_updated_at();
drop trigger if exists trg_gencouv_steps_updated_at on public.gencouv_email_sequence_steps;
create trigger trg_gencouv_steps_updated_at before update on public.gencouv_email_sequence_steps for each row execute function public.set_updated_at();
drop trigger if exists trg_gencouv_messages_updated_at on public.gencouv_email_messages;
create trigger trg_gencouv_messages_updated_at before update on public.gencouv_email_messages for each row execute function public.set_updated_at();

alter table public.gencouv_email_sequences enable row level security;
alter table public.gencouv_email_sequence_steps enable row level security;
alter table public.gencouv_email_messages enable row level security;
alter table public.gencouv_email_events enable row level security;
alter table public.gencouv_sync_runs enable row level security;
alter table public.gencouv_external_record_map enable row level security;

create or replace view public.gencouv_email_analytics as
select
  organization_id,
  date_trunc('day', created_at) as day,
  count(*) as sent_or_queued,
  count(*) filter (where delivered_at is not null or status = 'delivered') as delivered,
  count(*) filter (where opened_at is not null or status = 'opened') as opened,
  count(*) filter (where clicked_at is not null or status = 'clicked') as clicked,
  count(*) filter (where bounced_at is not null or status = 'bounced') as bounced,
  count(*) filter (where complained_at is not null or status = 'complained') as complained,
  count(*) filter (where failed_at is not null or status = 'failed') as failed,
  count(*) filter (where suppressed_at is not null or status = 'suppressed') as suppressed
from public.gencouv_email_messages
group by organization_id, date_trunc('day', created_at);

insert into public.gencouv_email_sequences (organization_id, name, description, status, sender_name, sender_email, reply_to_email, daily_limit)
select '05737e03-f8f0-4202-8e9b-0a8982a1091c'::uuid, 'Gencouv Onboarding', 'Editable onboarding email sequence managed from the Flux Knight dashboard and sent through Resend.', 'draft', 'Gencouv', 'onboarding@gencouv.com', 'support@gencouv.com', 10
where not exists (
  select 1 from public.gencouv_email_sequences where organization_id='05737e03-f8f0-4202-8e9b-0a8982a1091c'::uuid and name='Gencouv Onboarding'
);
