create or replace function public.update_customer_stage(
  p_organization_id uuid,
  p_customer_id uuid,
  p_stage_id uuid,
  p_changed_by_type text,
  p_changed_by_id text default null,
  p_reason text default null,
  p_source text default 'runtime',
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_old uuid;
  v_name text;
  v_history_id uuid;
begin
  select current_stage_id into v_old
  from public.crm_customers
  where organization_id=p_organization_id and id=p_customer_id
  for update;
  if not found then raise exception 'Customer not found in organization'; end if;

  select name into v_name
  from public.organization_customer_stages
  where organization_id=p_organization_id and id=p_stage_id and status='active';
  if not found then raise exception 'Stage not found in organization'; end if;

  update public.crm_customers
  set current_stage_id=p_stage_id,stage_updated_at=now(),updated_at=now()
  where organization_id=p_organization_id and id=p_customer_id;

  insert into public.customer_stage_history(
    organization_id,customer_id,from_stage_id,to_stage_id,changed_by_type,changed_by_id,reason,source,metadata
  ) values(
    p_organization_id,p_customer_id,v_old,p_stage_id,p_changed_by_type,p_changed_by_id,p_reason,p_source,coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_history_id;

  perform public.add_customer_timeline_event(
    p_organization_id,p_customer_id,'customer.stage_changed','Customer stage changed',
    coalesce(p_reason,'Stage updated to '||v_name),'internal',null,'customer_stage_history',
    v_history_id,null,p_changed_by_type,p_changed_by_id,
    jsonb_build_object('from_stage_id',v_old,'to_stage_id',p_stage_id,'to_stage_name',v_name,'source',p_source),now()
  );

  return jsonb_build_object('customer_id',p_customer_id,'stage_id',p_stage_id,'stage_name',v_name);
end $$;

revoke all on function public.update_customer_stage(uuid,uuid,uuid,text,text,text,text,jsonb)
from public,anon,authenticated;
grant execute on function public.update_customer_stage(uuid,uuid,uuid,text,text,text,text,jsonb)
to service_role;
