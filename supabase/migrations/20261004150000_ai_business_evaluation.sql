create table if not exists public.ai_business_evaluation_sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'collecting' check(status in ('collecting','evaluated','approved','declined')),
  industry text,
  context jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  evaluation jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_business_evaluation_sessions_updated_idx on public.ai_business_evaluation_sessions(updated_at desc);
alter table public.evaluation_leads add column if not exists evaluation_session_id uuid references public.ai_business_evaluation_sessions(id) on delete set null;
alter table public.evaluation_leads add column if not exists ai_evaluation jsonb;
alter table public.evaluation_leads add column if not exists pricing_type text;
alter table public.evaluation_leads add column if not exists approval_at timestamptz;
create table if not exists public.evaluation_implementation_opportunities (
  id uuid primary key default gen_random_uuid(),
  evaluation_lead_id uuid not null references public.evaluation_leads(id) on delete cascade,
  customer_id uuid,
  conversation_id uuid,
  title text not null,
  pricing_type text not null check(pricing_type in ('custom','standard')),
  status text not null default 'new' check(status in ('new','contact_pending','contacted','discovery','proposal','won','lost')),
  evaluation jsonb not null default '{}'::jsonb,
  contact_consent boolean not null default false,
  contact_channels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evaluation_implementation_opportunities_status_idx on public.evaluation_implementation_opportunities(status, created_at desc);
alter table public.ai_business_evaluation_sessions enable row level security;
alter table public.evaluation_implementation_opportunities enable row level security;
revoke all on public.ai_business_evaluation_sessions, public.evaluation_implementation_opportunities from anon, authenticated;
grant all on public.ai_business_evaluation_sessions, public.evaluation_implementation_opportunities to service_role;
