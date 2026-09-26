create or replace function public.enqueue_agent_execution(
  p_organization_id uuid,
  p_agent_id uuid,
  p_conversation_id uuid,
  p_input jsonb,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_ready boolean := false;
  v_execution_id uuid;
begin
  if coalesce(trim(p_idempotency_key),'')='' then raise exception 'Idempotency key is required'; end if;
  if not exists(
    select 1 from public.agents a
    where a.organization_id=p_organization_id and a.id=p_agent_id
      and a.status in ('testing','published','active')
  ) then raise exception 'Agent is not active in organization'; end if;

  select (
    r.readiness_score=100 and r.business_profile_ready and r.prompt_ready
    and r.knowledge_ready and r.integrations_ready and r.test_ready
    and r.approval_ready and r.workflow_ready
  ) into v_ready
  from public.agent_runtime_readiness r
  where r.organization_id=p_organization_id and r.agent_id=p_agent_id;

  if not coalesce(v_ready,false) then raise exception 'Agent is not ready for execution'; end if;

  if p_conversation_id is not null and not exists(
    select 1 from public.agent_conversations c
    where c.organization_id=p_organization_id and c.id=p_conversation_id and c.agent_id=p_agent_id
  ) then raise exception 'Conversation does not belong to agent organization'; end if;

  select q.execution_id into v_execution_id
  from public.command_queue q
  where q.organization_id=p_organization_id and q.idempotency_key=p_idempotency_key
    and q.execution_id is not null
  limit 1;
  if v_execution_id is not null then return v_execution_id; end if;

  insert into public.runtime_executions(organization_id,agent_id,conversation_id,status,input)
  values(p_organization_id,p_agent_id,p_conversation_id,'queued',coalesce(p_input,'{}'::jsonb))
  returning id into v_execution_id;

  insert into public.command_queue(organization_id,agent_id,execution_id,command_type,payload,idempotency_key)
  values(p_organization_id,p_agent_id,v_execution_id,'agent.respond',jsonb_build_object('execution_id',v_execution_id),p_idempotency_key);

  return v_execution_id;
end $$;
revoke all on function public.enqueue_agent_execution(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.enqueue_agent_execution(uuid,uuid,uuid,jsonb,text) to service_role;
