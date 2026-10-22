begin;

create table if not exists public.elevenlabs_voice_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  conversation_id text not null,
  elevenlabs_agent_id text,
  elevenlabs_version_id text,
  direction text not null default 'inbound' check (direction in ('inbound','outbound','unknown')),
  status text not null default 'completed' check (status in ('initiated','completed','failed','transfer_failed','handoff_required')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  transfer_status text,
  caller_phone text,
  transcript text,
  summary text,
  analysis jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  flux_credits_charged integer not null default 0,
  metered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, conversation_id),
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade
);

create table if not exists public.elevenlabs_voice_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  conversation_id text,
  organization_id uuid references public.organizations(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index if not exists elevenlabs_voice_calls_org_created_idx
  on public.elevenlabs_voice_calls (organization_id, created_at desc);
create index if not exists elevenlabs_voice_calls_conversation_idx
  on public.elevenlabs_voice_calls (conversation_id);
create index if not exists elevenlabs_voice_webhook_events_conversation_idx
  on public.elevenlabs_voice_webhook_events (conversation_id, received_at desc);

alter table public.elevenlabs_voice_calls enable row level security;
alter table public.elevenlabs_voice_webhook_events enable row level security;

create policy elevenlabs_voice_calls_tenant_read on public.elevenlabs_voice_calls
  for select to authenticated using (public.is_organization_member(organization_id));
create policy elevenlabs_voice_webhook_events_admin_only on public.elevenlabs_voice_webhook_events
  for select to authenticated using (public.is_organization_member(organization_id));

revoke all on public.elevenlabs_voice_calls, public.elevenlabs_voice_webhook_events from anon, authenticated;
grant select on public.elevenlabs_voice_calls, public.elevenlabs_voice_webhook_events to authenticated;

do $$
begin
  alter table public.agents add constraint agents_voice_agent_id_unique_per_org
    unique (organization_id, id);
exception when duplicate_object then null;
end $$;

commit;
