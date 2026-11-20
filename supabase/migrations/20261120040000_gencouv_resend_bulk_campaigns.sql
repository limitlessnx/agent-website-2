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
  consent_confirmed_by text not null,
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
revoke all on public.gencouv_bulk_campaigns, public.gencouv_bulk_recipients from anon, authenticated;
grant select, insert, update, delete on public.gencouv_bulk_campaigns, public.gencouv_bulk_recipients to service_role;

-- Service-role-only atomic claiming. Keep reservations on ambiguous outcomes;
-- do not automatically requeue them, because provider acceptance may be unknown.
create or replace function public.gencouv_claim_bulk_batch(
  p_organization_id uuid, p_campaign_id uuid, p_requested integer default 100
)
returns setof public.gencouv_bulk_recipients
language plpgsql security invoker set search_path = public
as $$
declare
  v_used integer;
  v_available integer;
  v_start timestamptz;
begin
  if p_requested is null or p_requested < 1 or p_requested > 100 then
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
  -- At most 100 reservations per UTC day for this bulk system. Other Resend sends\n  -- share the provider quota and may reduce what is actually available.
  v_available := greatest(0, least(p_requested, 100 - v_used));
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

-- Immutable operator-attestation trail for imported contacts.
create table if not exists public.gencouv_contact_consent_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  decision text not null check (decision in ('granted','denied')),
  consent_source text,
  confirmed_by text not null,
  confirmed_at timestamptz not null default now(),
  foreign key (customer_id,organization_id) references public.crm_customers(id,organization_id)
);
create index if not exists gencouv_consent_audit_contact_idx
  on public.gencouv_contact_consent_audit(organization_id,customer_id,confirmed_at desc);
alter table public.gencouv_contact_consent_audit enable row level security;
revoke all on public.gencouv_contact_consent_audit from anon, authenticated;
grant select,insert on public.gencouv_contact_consent_audit to service_role;

-- One transaction updates contact metadata and writes its audit event.
create or replace function public.gencouv_record_imported_contact_consent(
  p_organization_id uuid,
  p_customer_id uuid,
  p_accepted boolean,
  p_source text,
  p_admin_email text
)
returns boolean
language plpgsql security invoker set search_path = public
as $$
declare
  v_contact record;
  v_source text := btrim(coalesce(p_source,''));
begin
  if p_admin_email is null or length(btrim(p_admin_email)) < 3 then
    raise exception 'Admin identity is required';
  end if;
  if p_accepted and (length(v_source) < 8 or length(v_source) > 300) then
    raise exception 'A real source of prior consent is required';
  end if;
  select email,status,metadata into v_contact from public.crm_customers
    where id=p_customer_id and organization_id=p_organization_id
    for update;
  if not found or coalesce(v_contact.metadata->>'source','') <> 'gencouv_document_import'
     or v_contact.status in ('blocked','archived') then
    raise exception 'Contact is not eligible for import consent review';
  end if;
  if p_accepted and exists (
    select 1 from public.gencouv_suppression_list
      where organization_id=p_organization_id
        and normalized_email=lower(btrim(v_contact.email))
  ) then
    raise exception 'Suppressed contact cannot be marked as consented';
  end if;
  update public.crm_customers
    set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'marketing_consent', case when p_accepted then 'granted' else 'denied' end,
      'marketing_consent_source', case when p_accepted then v_source else '' end,
      'marketing_consent_verified_at', now(),
      'marketing_consent_verified_by', p_admin_email
    ), updated_at=now()
    where id=p_customer_id and organization_id=p_organization_id;
  insert into public.gencouv_contact_consent_audit
    (organization_id,customer_id,decision,consent_source,confirmed_by)
    values(p_organization_id,p_customer_id,
      case when p_accepted then 'granted' else 'denied' end,
      case when p_accepted then v_source else null end,
      p_admin_email);
  return true;
end;
$$;
revoke all on function public.gencouv_record_imported_contact_consent(uuid,uuid,boolean,text,text)
  from public, anon, authenticated;
grant execute on function public.gencouv_record_imported_contact_consent(uuid,uuid,boolean,text,text)
  to service_role;

-- One operator decision for the reviewed import group, saved atomically for
-- every eligible contact. This is an attestation of permission already obtained,
-- never evidence inferred merely from a common public source.
create or replace function public.gencouv_record_import_group_consent(
  p_organization_id uuid, p_customer_ids uuid[], p_accepted boolean,
  p_source text, p_admin_email text
)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  v_id uuid;
  v_count integer;
begin
  v_count := coalesce(array_length(p_customer_ids,1),0);
  if v_count < 1 or v_count > 500 or
     (select count(distinct id) from unnest(p_customer_ids) as t(id)) <> v_count then
    raise exception 'Invalid group size or duplicate contacts';
  end if;
  -- Uses the existing tenant scoped, row-locked and suppression-aware function.
  -- Any failure rolls back all consent changes and audits in this transaction.
  foreach v_id in array p_customer_ids loop
    perform public.gencouv_record_imported_contact_consent(
      p_organization_id,v_id,p_accepted,p_source,p_admin_email);
  end loop;
  return v_count;
end;
$$;
revoke all on function public.gencouv_record_import_group_consent(uuid,uuid[],boolean,text,text)
  from public, anon, authenticated;
grant execute on function public.gencouv_record_import_group_consent(uuid,uuid[],boolean,text,text)
  to service_role;
