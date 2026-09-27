insert into public.system_event_contracts(event_type,category,description,required_payload_keys)
values ('follow_up.requested','follow_up','A follow-up action was requested.',array[]::text[])
on conflict(event_type) do update set category=excluded.category,description=excluded.description,
required_payload_keys=excluded.required_payload_keys,status='active',updated_at=now();

create or replace function public.publish_system_event(
  p_organization_id uuid,p_source_system_id uuid,p_event_type text,p_payload jsonb,
  p_target_system_id uuid default null,p_customer_id uuid default null,p_conversation_id uuid default null,
  p_correlation_id uuid default null,p_causation_id uuid default null,p_idempotency_key text default null,
  p_source text default 'system'
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_event_id uuid; v_source_catalog_id uuid; v_target_catalog_id uuid;
  v_contract_version integer; v_required_keys text[]; v_key text;
begin
  if coalesce(trim(p_event_type),'')='' then raise exception 'event_type is required'; end if;
  if coalesce(trim(p_source),'')='' then raise exception 'source is required'; end if;

  select contract_version,required_payload_keys into v_contract_version,v_required_keys
  from public.system_event_contracts where event_type=trim(p_event_type) and status='active' limit 1;
  if v_contract_version is null then raise exception 'Unregistered or inactive system event contract: %',trim(p_event_type); end if;
  foreach v_key in array coalesce(v_required_keys,'{}'::text[]) loop
    if not coalesce(p_payload,'{}'::jsonb) ? v_key then
      raise exception 'Event % is missing required payload key %',trim(p_event_type),v_key;
    end if;
  end loop;

  select os.system_id into v_source_catalog_id from public.organization_systems os
  where os.organization_id=p_organization_id and os.id=p_source_system_id and os.status='active';
  if v_source_catalog_id is null then raise exception 'Source system is not active in organization'; end if;
  if not public.organization_can_use_system(p_organization_id,v_source_catalog_id) then raise exception 'Source system is not entitled for organization'; end if;

  if p_target_system_id is not null then
    select os.system_id into v_target_catalog_id from public.organization_systems os
    where os.organization_id=p_organization_id and os.id=p_target_system_id and os.status='active';
    if v_target_catalog_id is null then raise exception 'Target system is not active in organization'; end if;
    if not public.organization_can_use_system(p_organization_id,v_target_catalog_id) then raise exception 'Target system is not entitled for organization'; end if;
  end if;

  if p_customer_id is not null and not exists(select 1 from public.crm_customers c where c.organization_id=p_organization_id and c.id=p_customer_id)
    then raise exception 'Customer does not belong to organization'; end if;
  if p_conversation_id is not null and not exists(select 1 from public.crm_conversations c where c.organization_id=p_organization_id and c.id=p_conversation_id)
    then raise exception 'Conversation does not belong to organization'; end if;

  if p_idempotency_key is not null then
    select id into v_event_id from public.domain_events
    where organization_id=p_organization_id and idempotency_key=p_idempotency_key limit 1;
    if v_event_id is not null then return v_event_id; end if;
  end if;

  insert into public.domain_events(
    organization_id,source_system_id,target_system_id,customer_id,conversation_id,
    correlation_id,causation_id,event_type,source,payload,status,idempotency_key,metadata
  ) values (
    p_organization_id,p_source_system_id,p_target_system_id,p_customer_id,p_conversation_id,
    coalesce(p_correlation_id,gen_random_uuid()),p_causation_id,trim(p_event_type),trim(p_source),
    coalesce(p_payload,'{}'::jsonb),'pending',nullif(trim(coalesce(p_idempotency_key,'')),''),
    jsonb_build_object('contract_version',v_contract_version)
  ) returning id into v_event_id;
  return v_event_id;
end
$$;
revoke all on function public.publish_system_event(uuid,uuid,text,jsonb,uuid,uuid,uuid,uuid,uuid,text,text)
from public,anon,authenticated;
grant execute on function public.publish_system_event(uuid,uuid,text,jsonb,uuid,uuid,uuid,uuid,uuid,text,text)
to service_role;
