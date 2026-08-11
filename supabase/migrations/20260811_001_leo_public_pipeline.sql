create table if not exists public.leo_public_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  company_name text,
  industry text,
  recommended_plan text,
  qualification jsonb not null default '{}'::jsonb,
  notes text,
  source text not null default 'leo_public_website',
  status text not null default 'new',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leo_public_leads_status_created_idx
  on public.leo_public_leads (status, created_at desc);

create index if not exists leo_public_leads_email_idx
  on public.leo_public_leads (lower(email))
  where email is not null;

create index if not exists leo_public_leads_phone_idx
  on public.leo_public_leads (phone)
  where phone is not null;

alter table public.leo_public_leads enable row level security;

-- Server-only by default. Public website visitors interact through the protected
-- Leo server routes; no direct browser select/insert policy is intentionally added.
