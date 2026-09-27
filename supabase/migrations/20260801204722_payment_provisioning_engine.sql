begin;

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null,
  provider text not null check (provider in ('paystack','stripe','manual')),
  provider_reference text not null unique,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'NGN',
  status text not null default 'initialized' check (status in ('initialized','pending','paid','failed','cancelled','refunded')),
  checkout_url text,
  provider_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, quote_id) references public.organization_quotes(organization_id, id) on delete restrict
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create table if not exists public.provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_attempt_id uuid,
  agent_selection_id uuid,
  job_type text not null check (job_type in ('activate_subscription','provision_agent','create_channel_placeholders','create_crm_defaults')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, payment_attempt_id) references public.payment_attempts(organization_id, id) on delete cascade,
  foreign key (organization_id, agent_selection_id) references public.organization_agent_selections(organization_id, id) on delete cascade
);

create or replace function private.queue_paid_quote_provisioning(target_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payment_attempts%rowtype;
  selection record;
begin
  select * into payment from public.payment_attempts where id = target_payment_id for update;
  if payment.id is null or payment.status <> 'paid' then
    raise exception 'Payment is not paid';
  end if;

  update public.organization_quotes
  set status = 'paid', updated_at = now()
  where id = payment.quote_id and organization_id = payment.organization_id;

  insert into public.provisioning_jobs (organization_id, payment_attempt_id, job_type, payload)
  values (payment.organization_id, payment.id, 'activate_subscription', jsonb_build_object('quote_id', payment.quote_id))
  on conflict do nothing;

  for selection in
    select id from public.organization_agent_selections
    where organization_id = payment.organization_id and status in ('selected','configured','quoted','payment_pending')
  loop
    update public.organization_agent_selections set status = 'paid', updated_at = now() where id = selection.id;
    insert into public.provisioning_jobs (organization_id, payment_attempt_id, agent_selection_id, job_type)
    values (payment.organization_id, payment.id, selection.id, 'provision_agent');
  end loop;
end;
$$;

revoke all on function private.queue_paid_quote_provisioning(uuid) from public, anon, authenticated;

alter table public.payment_attempts enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.provisioning_jobs enable row level security;

create policy "members_view_payment_attempts" on public.payment_attempts for select to authenticated
using (public.is_organization_member(organization_id));
create policy "members_create_payment_attempts" on public.payment_attempts for insert to authenticated
with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "members_view_provisioning_jobs" on public.provisioning_jobs for select to authenticated
using (public.is_organization_member(organization_id));

create index if not exists payment_attempts_org_status_idx on public.payment_attempts(organization_id, status);
create index if not exists provisioning_jobs_ready_idx on public.provisioning_jobs(status, available_at);

commit;
