create extension if not exists pgcrypto;

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  title text not null default 'New support conversation',
  status text not null default 'open' check (status in ('open','diagnosing','waiting_approval','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  created_by text,
  assigned_agent text not null default 'agent-leo',
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  diagnostics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.support_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  action_key text not null,
  title text not null,
  description text,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high')),
  status text not null default 'proposed' check (status in ('proposed','approved','running','completed','failed','rejected')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  approved_by text,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists support_conversations_status_idx on public.support_conversations(status, updated_at desc);
create index if not exists support_messages_conversation_idx on public.support_messages(conversation_id, created_at);
create index if not exists support_actions_status_idx on public.support_actions(status, created_at desc);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_actions enable row level security;

comment on table public.support_conversations is 'Agent Leo AI support conversations for Fluxknight super admins.';
comment on table public.support_actions is 'Approval-gated operational actions proposed by Agent Leo.';