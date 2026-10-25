begin;

create unique index if not exists follow_ups_org_id_unique
  on public.follow_ups(organization_id, id);
create unique index if not exists leads_org_id_unique
  on public.leads(organization_id, id);

-- This is a tracking relation only. It does not create a second sender.
-- Existing canonical WhatsApp delivery remains the
-- provider boundary; this table preserves the request/provider correlation.
create table public.real_estate_outbound_tracking (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  outbound_kind text not null check (outbound_kind in ('followup','campaign','campaign_recipient')),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 512),
  campaign_id text,
  follow_up_id uuid,
  lead_id uuid,
  recipient text,
  provider text,
  provider_message_id text,
  lifecycle_status text not null default 'prepared'
    check (lifecycle_status in ('prepared','approved','executing','executed','received','failed','unknown','cancelled')),
  delivery_status text not null default 'unknown'
    check (delivery_status in ('unknown','accepted','sent','delivered','read','failed','partial')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, follow_up_id)
    references public.follow_ups(organization_id, id) on delete cascade,
  foreign key (organization_id, lead_id)
    references public.leads(organization_id, id) on delete cascade,
  check (outbound_kind <> 'followup' or follow_up_id is not null),
  check (outbound_kind = 'followup' or campaign_id is not null),
  check (provider_message_id is null or length(btrim(provider_message_id)) between 1 and 512)
);

create index real_estate_outbound_tracking_org_campaign_idx
  on public.real_estate_outbound_tracking(organization_id, campaign_id, created_at desc)
  where campaign_id is not null;
create index real_estate_outbound_tracking_org_provider_idx
  on public.real_estate_outbound_tracking(organization_id, provider_message_id)
  where provider_message_id is not null;
create index real_estate_outbound_tracking_org_status_idx
  on public.real_estate_outbound_tracking(organization_id, lifecycle_status, delivery_status, updated_at desc);

create trigger set_real_estate_outbound_tracking_updated_at
before update on public.real_estate_outbound_tracking
for each row execute function public.set_updated_at();

alter table public.real_estate_outbound_tracking enable row level security;
revoke all on public.real_estate_outbound_tracking from public, anon, authenticated;
grant select on public.real_estate_outbound_tracking to authenticated;
grant all on public.real_estate_outbound_tracking to service_role;

create policy real_estate_outbound_tracking_member_select
on public.real_estate_outbound_tracking for select to authenticated
using (public.is_organization_member(organization_id));

commit;
