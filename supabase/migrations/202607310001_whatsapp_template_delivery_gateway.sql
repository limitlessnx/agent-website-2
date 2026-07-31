create extension if not exists pgcrypto;

create table if not exists public.whatsapp_template_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  purpose text not null default 'follow_up_outside_24h',
  template_name text not null,
  language_code text not null default 'en',
  variable_keys jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','paused','disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, purpose)
);

create table if not exists public.whatsapp_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  recipient text not null,
  message_type text not null check (message_type in ('text','template')),
  template_name text,
  provider_message_id text,
  status text not null default 'pending' check (status in ('pending','accepted','failed','blocked')),
  error_code text,
  error_message text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_delivery_attempts_org_created_idx on public.whatsapp_delivery_attempts (organization_id, created_at desc);
create index if not exists whatsapp_delivery_attempts_recipient_idx on public.whatsapp_delivery_attempts (recipient, created_at desc);

alter table public.whatsapp_template_configs enable row level security;
alter table public.whatsapp_delivery_attempts enable row level security;

create or replace function public.set_whatsapp_template_config_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists whatsapp_template_configs_set_updated_at on public.whatsapp_template_configs;
create trigger whatsapp_template_configs_set_updated_at before update on public.whatsapp_template_configs for each row execute function public.set_whatsapp_template_config_updated_at();
