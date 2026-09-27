create table if not exists public.pm_onboarding_handoffs (
  id uuid primary key default gen_random_uuid(),
  handoff_code text not null unique,
  support_conversation_id uuid references public.gencouv_support_conversations(id) on delete set null,
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  customer_email text,
  customer_name text,
  source text not null default 'website_support_ai',
  intended_deposit numeric,
  recommended_account_type text check (recommended_account_type in ('lirunex_cent','mt5_standard')),
  qualification_status text not null default 'interested' check (qualification_status in ('interested','qualified','needs_review','started','completed','closed')),
  onboarding_status text not null default 'pending_telegram' check (onboarding_status in ('pending_telegram','telegram_opened','in_progress','approved','rejected','abandoned')),
  context jsonb not null default '{}'::jsonb,
  telegram_url text,
  telegram_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pm_onboarding_handoffs_created_idx
  on public.pm_onboarding_handoffs(created_at desc);

create index if not exists pm_onboarding_handoffs_status_idx
  on public.pm_onboarding_handoffs(onboarding_status, created_at desc);

alter table public.pm_onboarding_handoffs enable row level security;

create policy "Users can view own PM handoffs"
on public.pm_onboarding_handoffs
for select
to authenticated
using (auth.uid() = user_id);
