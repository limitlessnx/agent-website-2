-- Atomic finalization of the existing runtime execution. No provider or wallet calls.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $$begin
 if to_regprocedure('public.complete_runtime_execution(uuid,uuid,uuid,text,jsonb,text,text)') is not null then
  raise exception 'Existing completion function requires review';
 end if;
end$$;
create function public.complete_runtime_execution(
 p_organization_id uuid,p_agent_id uuid,p_execution_id uuid,p_status text,p_output jsonb,
 p_error_code text default null,p_error_message text default null
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare
 e public.runtime_executions;
 prior public.runtime_progress_events;
 fingerprint text;
 receipt uuid:=gen_random_uuid();
 usage_id uuid;
 result jsonb;
 workflow_key text;
 completed timestamptz:=clock_timestamp();
 latency integer;
begin
 if p_organization_id is null or p_agent_id is null or p_execution_id is null
  or p_status is null or p_status not in ('succeeded','failed','blocked','cancelled')
  or jsonb_typeof(p_output) is distinct from 'object'
  or (p_status not in ('failed','blocked') and (p_error_code is not null or p_error_message is not null)) then
  raise exception 'completion_input_invalid';
 end if;
 perform 1 from public.organizations where id=p_organization_id and status='active' for share;
 if not found then raise exception 'completion_scope_mismatch'; end if;
 select * into e from public.runtime_executions where id=p_execution_id and organization_id=p_organization_id and agent_id=p_agent_id for update;
 if e.id is null or not exists(select 1 from public.agents where id=p_agent_id and organization_id=p_organization_id) then raise exception 'completion_scope_mismatch'; end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('status',p_status,'output',p_output,'error_code',p_error_code,'error_message',p_error_message)::text,'UTF8')),'hex');
 select * into prior from public.runtime_progress_events ev where ev.organization_id=p_organization_id and ev.execution_id=p_execution_id and ev.event_type='execution.finalization_committed' order by id limit 1;
 if prior.id is not null then
  if prior.payload->>'agent_id' is distinct from p_agent_id::text or prior.payload->>'request_fingerprint' is distinct from fingerprint then raise exception 'completion_input_conflict'; end if;
  result:=prior.payload->'result';
  if jsonb_typeof(result) is distinct from 'object'
   or prior.payload->>'result_fingerprint' is distinct from encode(sha256(convert_to(result::text,'UTF8')),'hex')
   or e.status is distinct from p_status or e.output is distinct from p_output
   or e.error_code is distinct from p_error_code or e.error_message is distinct from p_error_message
   or e.completed_at is distinct from (result->>'completed_at')::timestamptz
   or e.latency_ms is distinct from (result->>'latency_ms')::integer
   or not exists(select 1 from public.usage_ledger u where u.organization_id=p_organization_id and u.agent_id=p_agent_id and u.execution_id=p_execution_id and u.id=(prior.payload->>'usage_id')::uuid and u.usage_type='workflow_execution' and u.quantity=1 and u.unit_cost_minor=0 and u.metadata->>'completion_receipt_id'=prior.payload->>'receipt_id')
   or not exists(select 1 from public.audit_logs a where a.organization_id=p_organization_id and a.action='runtime.execution_finalized' and a.resource_type='runtime_execution' and a.resource_id=p_execution_id::text and a.metadata->>'receipt_id'=prior.payload->>'receipt_id' and a.metadata->>'request_fingerprint'=fingerprint and a.metadata->>'result_fingerprint'=prior.payload->>'result_fingerprint') then
   raise exception 'completion_evidence_unavailable';
  end if;
  return result||jsonb_build_object('duplicate',true);
 end if;
 -- Historic terminal states/partial telemetry cannot prove a new atomic commit.
 if e.status not in ('queued','running') or e.completed_at is not null
  or exists(select 1 from public.usage_ledger u where u.organization_id=p_organization_id and u.execution_id=p_execution_id and u.usage_type='workflow_execution')
  or exists(select 1 from public.runtime_progress_events ev where ev.organization_id=p_organization_id and ev.execution_id=p_execution_id and ev.event_type in ('execution.succeeded','execution.failed','execution.blocked','execution.cancelled')) then raise exception 'legacy_completion_requires_review'; end if;
 latency:=least(2147483647,greatest(0,floor(extract(epoch from (completed-coalesce(e.started_at,e.created_at)))*1000)))::integer;
 workflow_key:=coalesce(nullif(e.input->>'workflow_key',''),nullif(e.execution_context->>'workflow_key',''),'unknown');
 update public.runtime_executions set status=p_status,output=p_output,error_code=p_error_code,error_message=p_error_message,latency_ms=latency,completed_at=completed
  where organization_id=p_organization_id and id=p_execution_id and agent_id=p_agent_id;
 insert into public.usage_ledger(organization_id,agent_id,execution_id,usage_type,quantity,unit_cost_minor,metadata)
 values(p_organization_id,p_agent_id,p_execution_id,'workflow_execution',1,0,jsonb_build_object('status',p_status,'workflow_key',workflow_key,'completion_receipt_id',receipt)) returning id into usage_id;
 insert into public.runtime_progress_events(organization_id,execution_id,event_type,message,payload)
 values(p_organization_id,p_execution_id,'execution.'||p_status,'Runtime execution '||p_status||'.',jsonb_build_object('latency_ms',latency,'error_code',p_error_code,'completion_receipt_id',receipt));
 -- Only the parent runtime command is completed. Queued email/calendar/follow-up jobs are independent delivery work.
 update public.command_queue set status=case when p_status='succeeded' then 'succeeded' when p_status='cancelled' then 'cancelled' else 'failed' end,completed_at=completed,last_error=p_error_message
 where organization_id=p_organization_id and execution_id=p_execution_id and agent_id=p_agent_id and command_type='agent.respond' and status in ('queued','claimed','running');
 result:=jsonb_build_object('ok',true,'organization_id',p_organization_id,'agent_id',p_agent_id,'execution_id',p_execution_id,'id',p_execution_id,'status',p_status,'latency_ms',latency,'completed_at',completed,'output',p_output);
 insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
 values(p_organization_id,'runtime.execution_finalized','runtime_execution',p_execution_id::text,jsonb_build_object('actor_type','runtime_gateway','agent_id',p_agent_id,'execution_id',p_execution_id,'status',p_status,'receipt_id',receipt,'request_fingerprint',fingerprint,'result_fingerprint',encode(sha256(convert_to(result::text,'UTF8')),'hex')));
 -- Receipt stores references/hashes; output already belongs to the existing execution, not the audit log.
 insert into public.runtime_progress_events(organization_id,execution_id,event_type,message,payload)
 values(p_organization_id,p_execution_id,'execution.finalization_committed','Runtime execution finalization committed.',jsonb_build_object('agent_id',p_agent_id,'receipt_id',receipt,'usage_id',usage_id,'request_fingerprint',fingerprint,'result_fingerprint',encode(sha256(convert_to(result::text,'UTF8')),'hex'),'result',result));
 return result;
end
$fn$;
revoke all on function public.complete_runtime_execution(uuid,uuid,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.complete_runtime_execution(uuid,uuid,uuid,text,jsonb,text,text) to service_role;
commit;
