begin;

alter table public.real_estate_outbound_tracking
  add column if not exists delivery_status_received_at timestamptz,
  add column if not exists error_code text;
alter table public.real_estate_inspection_jobs
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists delivery_status text not null default 'unknown'
    check (delivery_status in ('unknown','accepted','sent','delivered','read','failed')),
  add column if not exists delivery_status_received_at timestamptz,
  add column if not exists provider_error_code text,
  add column if not exists provider_error_message text;

create index if not exists real_estate_outbound_tracking_provider_receipt_idx
  on public.real_estate_outbound_tracking(provider,provider_message_id)
  where provider is not null and provider_message_id is not null;
create index if not exists real_estate_inspection_jobs_provider_receipt_idx
  on public.real_estate_inspection_jobs(provider,provider_message_id)
  where provider is not null and provider_message_id is not null;
create unique index if not exists real_estate_outbound_tracking_org_provider_message_unique
  on public.real_estate_outbound_tracking(organization_id,provider,provider_message_id)
  where provider is not null and provider_message_id is not null;
create unique index if not exists real_estate_inspection_jobs_org_provider_message_unique
  on public.real_estate_inspection_jobs(organization_id,provider,provider_message_id)
  where provider is not null and provider_message_id is not null;

create or replace function public.real_estate_delivery_status_rank(p_status text)
returns integer language sql immutable parallel safe set search_path = pg_catalog as $$
  select case lower(coalesce(p_status,''))
    when 'accepted' then 1 when 'sent' then 2 when 'failed' then 3
    when 'delivered' then 4 when 'read' then 5 else 0 end;
$$;

-- Correlate only against the new real-estate outbox tables. If a provider ID
-- ambiguously maps to multiple tenant IDs, refuse to update anything.
create or replace function public.apply_real_estate_delivery_receipt(
  p_provider text,p_provider_message_id text,p_delivery_status text,
  p_event_at timestamptz,p_organization_id uuid,p_error_code text,p_error_message text
) returns table(applied boolean,organization_id uuid,delivery_status text,event_status text)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_org_ids uuid[];
  v_org uuid;
  v_current_status text;
  v_current_at timestamptz;
  v_rows integer:=0;
  v_updated integer;
  v_provider text:=lower(btrim(coalesce(p_provider,'')));
  v_message_id text:=btrim(coalesce(p_provider_message_id,''));
  v_status text:=lower(btrim(coalesce(p_delivery_status,'')));
  v_event_at timestamptz:=coalesce(p_event_at,clock_timestamp());
begin
  if v_provider not in ('meta','twilio') then raise exception 'Unsupported real-estate delivery provider'; end if;
  if v_message_id='' or length(v_message_id)>512 then raise exception 'Provider message ID is invalid'; end if;
  if v_status not in ('accepted','sent','delivered','read','failed') then raise exception 'Provider delivery state is invalid'; end if;
  select array_agg(distinct matches.organization_id) into v_org_ids from (
    select t.organization_id from public.real_estate_outbound_tracking t
    where t.provider=v_provider and t.provider_message_id=v_message_id
      and (p_organization_id is null or t.organization_id=p_organization_id)
    union all
    select j.organization_id from public.real_estate_inspection_jobs j
    where j.provider=v_provider and j.provider_message_id=v_message_id
      and (p_organization_id is null or j.organization_id=p_organization_id)
  ) matches;
  if coalesce(cardinality(v_org_ids),0)<>1 then
    return query select false,null::uuid,null::text,case when coalesce(cardinality(v_org_ids),0)=0 then 'unmatched' else 'ambiguous' end;
    return;
  end if;
  v_org:=v_org_ids[1];
  select matched.delivery_status,matched.received_at into v_current_status,v_current_at from (
    select t.delivery_status,t.delivery_status_received_at as received_at from public.real_estate_outbound_tracking t
    where t.organization_id=v_org and t.provider=v_provider and t.provider_message_id=v_message_id
    union all
    select j.delivery_status,j.delivery_status_received_at as received_at from public.real_estate_inspection_jobs j
    where j.organization_id=v_org and j.provider=v_provider and j.provider_message_id=v_message_id
  ) matched order by public.real_estate_delivery_status_rank(matched.delivery_status) desc,matched.received_at desc nulls last limit 1;
  if v_event_at < coalesce(v_current_at,'-infinity'::timestamptz)
    or public.real_estate_delivery_status_rank(v_status)<public.real_estate_delivery_status_rank(v_current_status)
    or (v_event_at=v_current_at and v_status=v_current_status) then
    return query select false,v_org,coalesce(v_current_status,'unknown'),'stale_or_duplicate';
    return;
  end if;

  update public.real_estate_outbound_tracking t set
    delivery_status=v_status,
    delivery_status_received_at=v_event_at,
    lifecycle_status=case when v_status in ('delivered','read') then 'received' when v_status='failed' then 'failed' else 'executed' end,
    error_code=case when v_status='failed' then left(p_error_code,100) else null end,
    error_message=case when v_status='failed' then left(p_error_message,1000) else null end
  where t.organization_id=v_org and t.provider=v_provider and t.provider_message_id=v_message_id
    and public.real_estate_delivery_status_rank(t.delivery_status)<=public.real_estate_delivery_status_rank(v_status)
    and coalesce(t.delivery_status_received_at,'-infinity'::timestamptz)<=v_event_at;
  get diagnostics v_updated=row_count; v_rows:=v_rows+v_updated;

  update public.real_estate_inspection_jobs j set
    delivery_status=v_status,
    delivery_status_received_at=v_event_at,
    provider_error_code=case when v_status='failed' then left(p_error_code,100) else null end,
    provider_error_message=case when v_status='failed' then left(p_error_message,1000) else null end,
    status=case when v_status='failed' and j.status<>'cancelled' then 'failed' else j.status end,
    payload=j.payload||jsonb_build_object('delivery_status',v_status,'delivery_status_received_at',v_event_at,'provider_error_code',case when v_status='failed' then left(p_error_code,100) else null end)
  where j.organization_id=v_org and j.provider=v_provider and j.provider_message_id=v_message_id
    and public.real_estate_delivery_status_rank(j.delivery_status)<=public.real_estate_delivery_status_rank(v_status)
    and coalesce(j.delivery_status_received_at,'-infinity'::timestamptz)<=v_event_at;
  get diagnostics v_updated=row_count; v_rows:=v_rows+v_updated;
  return query select v_rows>0,v_org,v_status,case when v_rows>0 then 'applied' else 'stale_or_duplicate' end;
end;
$$;

revoke all on function public.real_estate_delivery_status_rank(text) from public,anon,authenticated;
revoke all on function public.apply_real_estate_delivery_receipt(text,text,text,timestamptz,uuid,text,text) from public,anon,authenticated;
grant execute on function public.real_estate_delivery_status_rank(text) to service_role;
grant execute on function public.apply_real_estate_delivery_receipt(text,text,text,timestamptz,uuid,text,text) to service_role;
commit;
