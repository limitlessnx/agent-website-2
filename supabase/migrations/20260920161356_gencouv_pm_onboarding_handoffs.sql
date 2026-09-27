create table if not exists public.gencouv_pm_onboarding_handoffs (
  id uuid primary key default gen_random_uuid(),
  handoff_token text not null unique,
  conversation_id uuid not null references public.gencouv_support_conversations(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  customer_email text null,
  customer_name text null,
  country text null,
  intended_deposit numeric null,
  recommended_account_type text null check (recommended_account_type in ('lirunex_cent','mt5_standard')),
  status text not null default 'pending' check (status in ('pending','started','completed','expired','cancelled')),
  source text not null default 'website_support_ai',
  context jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '7 days'),
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gencouv_pm_handoffs_conversation_idx
  on public.gencouv_pm_onboarding_handoffs(conversation_id);

create index if not exists gencouv_pm_handoffs_status_created_idx
  on public.gencouv_pm_onboarding_handoffs(status, created_at desc);

alter table public.gencouv_pm_onboarding_handoffs enable row level security;
