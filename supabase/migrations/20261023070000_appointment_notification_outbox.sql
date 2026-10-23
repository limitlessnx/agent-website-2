begin;

-- Durable, tenant-scoped delivery outbox for appointment WhatsApp confirmations.
-- A unique event key makes enqueue idempotent. Processing rows are not silently
-- reclaimed after a crash because the provider may already have accepted a send.
create table if not exists public.appointment_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null,
  event_key text not null,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  purpose text not null default 'appointment_reminder',
  recipient text not null,
  template_name text not null,
  variables jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','processing','sent','failed','uncertain')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  last_error text,
  queued_at timestamptz not null default now(),
  processing_at timestamptz,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, event_key),
  -- Enforce tenant ownership in the relationship itself, not only in API
  -- filters. The migration below creates the required composite unique index
  -- without altering the appointments table's primary key.
  foreign key (organization_id, appointment_id)
    references public.appointments(organization_id, id) on delete cascade
);

create index if not exists appointment_notification_outbox_queue_idx
  on public.appointment_notification_outbox(status, queued_at)
  where status = 'queued';

alter table public.appointment_notification_outbox enable row level security;
revoke all on public.appointment_notification_outbox from anon, authenticated;
grant all on public.appointment_notification_outbox to service_role;

-- Atomic claim: concurrent workers cannot claim the same queued event.
-- A claimed event is never automatically reset to queued; a crash after provider
-- acceptance must be reconciled as uncertain rather than blindly resent.
create or replace function public.claim_appointment_notification_outbox(p_limit integer default 20)
returns setof public.appointment_notification_outbox
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select id
    from public.appointment_notification_outbox
    where status = 'queued'
    order by queued_at, id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.appointment_notification_outbox o
  set status = 'processing',
      processing_at = now(),
      attempt_count = o.attempt_count + 1,
      updated_at = now()
  from candidates c
  where o.id = c.id
  returning o.*;
$$;

revoke all on function public.claim_appointment_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_appointment_notification_outbox(integer) to service_role;

comment on table public.appointment_notification_outbox is
  'Tenant-scoped durable outbox for appointment notifications; processing events require reconciliation if interrupted.';
comment on column public.appointment_notification_outbox.event_key is
  'Stable idempotency key, unique within organization, e.g. appointment-confirmed:<appointment UUID>.';

commit;
