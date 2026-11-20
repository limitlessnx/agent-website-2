-- Gencouv marketing campaigns: explicit recipient reservations, no automatic sending.
-- Apply through the reviewed Supabase migration pipeline before enabling the route.
create table if not exists public.gencouv_bulk_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid,
  from_email text not null,
  subject text not null,
  text_body text not null,
  status text not null default 'draft' check (status in ('draft','ready','closed')),
  consent_confirmed boolean not null default false,
  consent_basis text not null,
  consent_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index if not exists gencouv_bulk_campaigns_org_idx on public.gencouv_bulk_campaigns(organization_id,created_at desc);
alter table public.gencouv_bulk_campaigns enable row level security;

create table if not exists public.gencouv_bulk_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  organization_id uuid not null,
  customer_id uuid not null,
  normalized_email text not null,
  recipient_name text,
  status text not null default 'queued'
    check (status in ('queued','sending','accepted','unknown','failed','suppressed')),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_email_id text,
  error_code text,
  created_at timestamptz not null default now(),
  foreign key (campaign_id,organization_id)
    references public.gencouv_bulk_campaigns(id,organization_id) on delete cascade,
  foreign key (customer_id,organization_id)
    references public.crm_customers(id,organization_id) on delete restrict,
  unique (campaign_id,normalized_email)
);
create index if not exists gencouv_bulk_recipients_org_claim_idx
  on public.gencouv_bulk_recipients(organization_id,claimed_at)
  where claimed_at is not null;
create index if not exists gencouv_bulk_recipients_queue_idx
  on public.gencouv_bulk_recipients(campaign_id,status,created_at);
alter table public.gencouv_bulk_recipients enable row level security;

-- Service-role-only atomic claiming. Keep reservations on ambiguous outcomes;
-- do not automatically requeue them, because provider acceptance may be unknown.
create or replace function public.gencouv_claim_bulk_batch(
  p_organization_id uuid, p_campaign_id uuid, p_requested integer default 10
)
returns setof public.gencouv_bulk_recipients
language plpgsql security invoker set search_path = public
as $$
declare
  v_used integer;
  v_available integer;
  v_start timestamptz;
begin
  if p_requested is null or p_requested < 1 or p_requested > 10 then
    raise exception 'Invalid batch size';
  end if;
  -- Serializes claims across every Gencouv campaign for the UTC day.
  perform pg_advisory_xact_lock(hashtext('gencouv_bulksend'),hashtext((now() at time zone 'UTC')::date::text));
  if not exists (
    select 1 from public.gencouv_bulk_campaigns
    where id = p_campaign_id and organization_id = p_organization_id
      and status = 'ready' and consent_confirmed = true
  ) then
    raise exception 'Campaign not ready';
  end if;
  v_start := (now() at time zone 'UTC')::date::timestamp at time zone 'UTC';
  select count(*) into v_used from public.gencouv_bulk_recipients
    where claimed_at >= v_start
      and claimed_at < v_start + interval '1 day'
      and status in ('sending','accepted','unknown','failed','suppressed');
  -- Conservative limit below the account's nominal 100/day.
  v_available := greatest(0, least(p_requested, 75 - v_used));
  if v_available = 0 then return; end if;
  return query
  with candidates as (
    select r.id from public.gencouv_bulk_recipients r
    where r.campaign_id = p_campaign_id
      and r.organization_id = p_organization_id and r.status = 'queued'
    order by r.created_at,r.id
    for update skip locked
    limit v_available
  )
  update public.gencouv_bulk_recipients r
  set status = 'sending', claimed_at = now()
  from candidates c where r.id = c.id
  returning r.*;
end;
$$;
revoke all on function public.gencouv_claim_bulk_batch(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.gencouv_claim_bulk_batch(uuid,uuid,integer) to service_role;
