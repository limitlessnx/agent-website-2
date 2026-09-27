create table if not exists public.gencouv_pm_handoffs (
  id uuid primary key default gen_random_uuid(),
  handoff_token text unique not null,
  conversation_id uuid references public.gencouv_support_conversations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  customer_email text,
  customer_name text,
  source text not null default 'website_support',
  status text not null default 'created' check (status in ('created','opened','in_progress','submitted','approved','rejected','expired')),
  context jsonb not null default '{}'::jsonb,
  telegram_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gencouv_pm_handoffs_token_idx
  on public.gencouv_pm_handoffs(handoff_token);

create index if not exists gencouv_pm_handoffs_status_created_idx
  on public.gencouv_pm_handoffs(status, created_at desc);

alter table public.gencouv_pm_handoffs enable row level security;

drop policy if exists "Users can view own PM handoffs" on public.gencouv_pm_handoffs;
create policy "Users can view own PM handoffs"
on public.gencouv_pm_handoffs
for select
using (auth.uid() = user_id);
