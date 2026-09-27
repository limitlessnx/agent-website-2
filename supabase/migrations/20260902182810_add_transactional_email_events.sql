create table if not exists public.transactional_email_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  user_id uuid null references auth.users(id) on delete set null,
  organization_id uuid null references public.organizations(id) on delete set null,
  payment_attempt_id uuid null references public.payment_attempts(id) on delete set null,
  recipient_email text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_response jsonb null,
  last_error text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactional_email_events_user_id_idx on public.transactional_email_events(user_id);
create index if not exists transactional_email_events_organization_id_idx on public.transactional_email_events(organization_id);
create index if not exists transactional_email_events_payment_attempt_id_idx on public.transactional_email_events(payment_attempt_id);
create index if not exists transactional_email_events_status_idx on public.transactional_email_events(status, created_at);

alter table public.transactional_email_events enable row level security;

revoke all on table public.transactional_email_events from anon, authenticated;
