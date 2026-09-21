create table if not exists public.leo_public_leads (
  id uuid primary key default gen_random_uuid(),
  session_id text unique,
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  industry text,
  recommended_plan text,
  qualification jsonb not null default '{}'::jsonb,
  notes text,
  source text not null default 'public_leo',
  status text not null default 'new',
  handoff_requested boolean not null default false,
  preferred_contact_method text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leo_public_leads enable row level security;

create index if not exists leo_public_leads_created_at_idx
  on public.leo_public_leads(created_at desc);

create index if not exists leo_public_leads_email_idx
  on public.leo_public_leads(lower(email));

comment on table public.leo_public_leads is
  'Server-only Public Leo evaluation and human-handoff records. RLS is enabled with no public policies; privileged server access is required.';
