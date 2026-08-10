-- Leo Core v2 persistence layer.
-- These tables are server-mediated. RLS is enabled with no broad client policies on purpose.

create extension if not exists pgcrypto;

create table if not exists public.leo_sessions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('public','tenant','super_admin','internal_service')),
  organization_id uuid null,
  user_id uuid null,
  membership_id uuid null,
  role text not null,
  channel text not null default 'chat' check (channel in ('chat','voice','api')),
  visibility text not null default 'private' check (visibility in ('private','team','organization')),
  status text not null default 'active' check (status in ('active','closed','expired')),
  page_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table if not exists public.leo_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.leo_sessions(id) on delete cascade,
  organization_id uuid null,
  user_id uuid null,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leo_tool_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.leo_sessions(id) on delete cascade,
  organization_id uuid null,
  tool_key text not null,
  arguments jsonb not null default '{}'::jsonb,
  approval_mode text not null check (approval_mode in ('none','confirm','admin')),
  status text not null default 'proposed' check (status in ('proposed','waiting_confirmation','waiting_admin','approved','rejected','executing','completed','failed','cancelled')),
  requested_by_user_id uuid null,
  requested_by_role text null,
  approved_by text null,
  approval_metadata jsonb not null default '{}'::jsonb,
  result jsonb null,
  error_message text null,
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  executed_at timestamptz null,
  completed_at timestamptz null
);

create table if not exists public.leo_audit_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid null references public.leo_sessions(id) on delete set null,
  tool_call_id uuid null references public.leo_tool_calls(id) on delete set null,
  organization_id uuid null,
  actor_user_id uuid null,
  actor_role text null,
  scope text not null,
  event_type text not null,
  tool_key text null,
  before_state jsonb null,
  after_state jsonb null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leo_sessions_org_idx on public.leo_sessions(organization_id, updated_at desc);
create index if not exists leo_sessions_user_idx on public.leo_sessions(user_id, updated_at desc);
create index if not exists leo_messages_session_idx on public.leo_messages(session_id, created_at asc);
create index if not exists leo_messages_org_idx on public.leo_messages(organization_id, created_at desc);
create index if not exists leo_tool_calls_session_idx on public.leo_tool_calls(session_id, created_at desc);
create index if not exists leo_tool_calls_org_status_idx on public.leo_tool_calls(organization_id, status, created_at desc);
create index if not exists leo_audit_logs_org_idx on public.leo_audit_logs(organization_id, created_at desc);
create index if not exists leo_audit_logs_session_idx on public.leo_audit_logs(session_id, created_at desc);

alter table public.leo_sessions enable row level security;
alter table public.leo_messages enable row level security;
alter table public.leo_tool_calls enable row level security;
alter table public.leo_audit_logs enable row level security;

comment on table public.leo_sessions is 'Server-mediated Leo sessions. Tenant scope is fixed by organization_id and authenticated identity.';
comment on table public.leo_tool_calls is 'Validated Leo tool proposals and executions. Permission and approval must be checked server-side before status advances.';
comment on table public.leo_audit_logs is 'Append-oriented audit trail for Leo identity, approval and tool execution events.';
