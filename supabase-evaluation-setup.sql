create extension if not exists pgcrypto;

create table if not exists public.evaluation_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  business_name text not null,
  business_type text not null,
  agent_types jsonb not null default '[]'::jsonb,
  main_goal text not null,
  current_tools text,
  lead_volume text not null,
  timeline text not null,
  budget text not null,
  preferred_contact_time text,
  consent_given boolean not null default false,
  source text not null default 'website_evaluation',
  status text not null default 'new',
  call_status text,
  call_transcript text,
  call_summary text,
  recommended_solution text,
  internal_notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evaluation_leads_status_idx
  on public.evaluation_leads (status);

create index if not exists evaluation_leads_submitted_at_idx
  on public.evaluation_leads (submitted_at desc);

alter table public.evaluation_leads enable row level security;

-- The website API route writes with SUPABASE_SERVICE_ROLE_KEY server-side.
-- Do not expose the service role key in browser/client code.
