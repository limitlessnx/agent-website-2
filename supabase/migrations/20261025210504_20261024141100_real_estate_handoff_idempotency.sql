begin;

-- Opt-in real-estate wrapper: existing generic handoff function remains unchanged.
create or replace function public.create_real_estate_handoff_once(
  p_organization_id uuid, p_customer_id uuid, p_conversation_id uuid,
  p_reason text, p_category text default 'general', p_priority text default 'normal',
  p_source_system_id uuid default null, p_source_agent_id uuid default null,
  p_correlation_id uuid default null, p_sla_due_at timestamptz default null,
  p_created_by_type text default 'agent', p_created_by_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_handoff_id uuid; v_conversation_id uuid;
begin
  -- Serializes all opt-in handoff creation for this same canonical conversation.
  select id into v_conversation_id from public.crm_conversations
  where id=p_conversation_id and organization_id=p_organization_id and customer_id=p_customer_id
  for update;
  if not found then raise exception 'Conversation does not belong to the customer organization'; end if;
  if p_source_agent_id is not null and not exists (
    select 1 from public.agents where id=p_source_agent_id and organization_id=p_organization_id
  ) then raise exception 'Agent does not belong to organization'; end if;
  select id into v_handoff_id from public.human_handoffs
  where organization_id=p_organization_id and conversation_id=p_conversation_id and customer_id=p_customer_id
    and ((p_correlation_id is not null and correlation_id=p_correlation_id)
      or status in ('open','assigned','in_progress','waiting_customer'))
  order by created_at desc limit 1;
  if found then return jsonb_build_object('handoffId',v_handoff_id,'created',false); end if;
  v_handoff_id := public.create_human_handoff(
    p_organization_id,p_customer_id,p_conversation_id,p_reason,p_category,p_priority,
    p_source_system_id,p_source_agent_id,p_correlation_id,p_sla_due_at,
    p_created_by_type,p_created_by_id,p_metadata);
  return jsonb_build_object('handoffId',v_handoff_id,'created',true);
end;
$$;
revoke all on function public.create_real_estate_handoff_once(uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_real_estate_handoff_once(uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,text,jsonb) to service_role;

commit;
