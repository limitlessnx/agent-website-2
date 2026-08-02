create table if not exists public.platform_provider_catalog (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  provider_type text not null check (provider_type in ('ai','voice')),
  status text not null default 'disabled' check (status in ('active','disabled','degraded')),
  credential_reference text,
  configuration jsonb not null default '{}'::jsonb,
  health jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_provider_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.platform_provider_catalog(id) on delete cascade,
  model_key text not null,
  display_name text not null,
  model_type text not null check (model_type in ('language','speech','voice')),
  status text not null default 'disabled' check (status in ('active','disabled')),
  capabilities jsonb not null default '{}'::jsonb,
  cost_controls jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_key)
);

create table if not exists public.agent_provider_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  ai_provider_id uuid references public.platform_provider_catalog(id) on delete restrict,
  ai_model_id uuid references public.platform_provider_models(id) on delete restrict,
  fallback_ai_provider_id uuid references public.platform_provider_catalog(id) on delete restrict,
  fallback_ai_model_id uuid references public.platform_provider_models(id) on delete restrict,
  voice_provider_id uuid references public.platform_provider_catalog(id) on delete restrict,
  voice_model_id uuid references public.platform_provider_models(id) on delete restrict,
  limits jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_id),
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade
);

alter table public.platform_provider_catalog enable row level security;
alter table public.platform_provider_models enable row level security;
alter table public.agent_provider_assignments enable row level security;

revoke all on public.platform_provider_catalog from anon, authenticated;
revoke all on public.platform_provider_models from anon, authenticated;
revoke all on public.agent_provider_assignments from anon, authenticated;

insert into public.platform_provider_catalog (provider_key, display_name, provider_type, status)
values
  ('openai', 'OpenAI', 'ai', 'disabled'),
  ('anthropic', 'Anthropic', 'ai', 'disabled'),
  ('gemini', 'Google Gemini', 'ai', 'disabled'),
  ('elevenlabs', 'ElevenLabs', 'voice', 'disabled'),
  ('retell', 'Retell AI', 'voice', 'disabled'),
  ('vapi', 'Vapi', 'voice', 'disabled')
on conflict (provider_key) do nothing;

update public.agents
set communication_channels = (
  select coalesce(jsonb_agg(value), '[]'::jsonb)
  from jsonb_array_elements_text(coalesce(communication_channels, '[]'::jsonb)) value
  where lower(value) <> 'sms'
)
where communication_channels @> '["sms"]'::jsonb;
