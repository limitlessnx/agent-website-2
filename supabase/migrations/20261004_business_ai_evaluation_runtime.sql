create table if not exists public.ai_business_evaluation_sessions (
  id uuid primary key default gen_random_uuid(),
  industry text,
  context jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  evaluation jsonb,
  contact_name text,
  contact_email text,
  contact_phone text,
  contact_consent boolean not null default false,
  status text not null default 'started',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_business_evaluation_sessions_status_idx
  on public.ai_business_evaluation_sessions(status);

create index if not exists ai_business_evaluation_sessions_email_idx
  on public.ai_business_evaluation_sessions(contact_email);

create table if not exists public.evaluation_implementation_opportunities (
  id uuid primary key default gen_random_uuid(),
  evaluation_lead_id uuid not null references public.evaluation_leads(id) on delete cascade,
  customer_id uuid,
  conversation_id uuid,
  title text not null,
  pricing_type text not null,
  status text not null default 'new',
  evaluation jsonb not null default '{}'::jsonb,
  contact_consent boolean not null default false,
  contact_channels text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evaluation_implementation_opportunities_lead_idx
  on public.evaluation_implementation_opportunities(evaluation_lead_id);

create index if not exists evaluation_implementation_opportunities_status_idx
  on public.evaluation_implementation_opportunities(status);
