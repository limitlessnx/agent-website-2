create extension if not exists pgcrypto;

create table if not exists public.leo_sessions (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid,
  membership_id uuid,
  role text not null,
  channel text not null,
  visibility text not null default 'private',
  status text not null default 'active',
  page_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leo_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.leo_sessions(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leo_tool_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.leo_sessions(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  tool_key text not null,
  arguments jsonb not null default '{}'::jsonb,
  approval_mode text,
  status text not null default 'proposed',
  requested_by_user_id uuid,
  requested_by_role text,
  created_at timestamptz not null default now()
);

create table if not exists public.leo_audit_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.leo_sessions(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid,
  actor_role text,
  scope text,
  event_type text not null,
  tool_key text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leo_sessions_public_idx on public.leo_sessions(scope,status,updated_at desc);
create index if not exists leo_sessions_org_idx on public.leo_sessions(organization_id,status,updated_at desc);
create index if not exists leo_messages_session_idx on public.leo_messages(session_id,created_at);
create index if not exists leo_messages_org_idx on public.leo_messages(organization_id,created_at desc);
create index if not exists leo_tool_calls_session_idx on public.leo_tool_calls(session_id,created_at desc);
create index if not exists leo_audit_logs_session_idx on public.leo_audit_logs(session_id,created_at desc);

alter table public.leo_sessions enable row level security;
alter table public.leo_messages enable row level security;
alter table public.leo_tool_calls enable row level security;
alter table public.leo_audit_logs enable row level security;

revoke all on public.leo_sessions,public.leo_messages,public.leo_tool_calls,public.leo_audit_logs from anon,authenticated;
grant all on public.leo_sessions,public.leo_messages,public.leo_tool_calls,public.leo_audit_logs to service_role;