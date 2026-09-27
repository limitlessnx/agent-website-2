create table if not exists public.gencouv_support_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text unique not null,
  user_id uuid references auth.users(id) on delete set null,
  customer_email text,
  customer_name text,
  page_url text,
  status text not null default 'open' check (status in ('open','handoff','closed')),
  last_intent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gencouv_support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.gencouv_support_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.gencouv_support_cases (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.gencouv_support_conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  customer_email text,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  summary text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gencouv_support_messages_conversation_idx
  on public.gencouv_support_messages(conversation_id, created_at);

create index if not exists gencouv_support_cases_status_idx
  on public.gencouv_support_cases(status, created_at);

alter table public.gencouv_support_conversations enable row level security;
alter table public.gencouv_support_messages enable row level security;
alter table public.gencouv_support_cases enable row level security;

drop policy if exists "Users can view own support conversations" on public.gencouv_support_conversations;
create policy "Users can view own support conversations"
on public.gencouv_support_conversations
for select using (auth.uid() = user_id);

drop policy if exists "Users can view own support cases" on public.gencouv_support_cases;
create policy "Users can view own support cases"
on public.gencouv_support_cases
for select using (auth.uid() = user_id);
