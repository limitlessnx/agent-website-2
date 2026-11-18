-- Proposed recovery boundary for the existing ElevenLabs receipt adapter.
-- All business writes, the existing credit RPC and completion commit together.
-- No new queue, receipt table, pricing policy or client permission is introduced.
begin;

do $$begin
  if to_regclass('public.elevenlabs_voice_calls') is null
    or to_regclass('public.elevenlabs_voice_webhook_events') is null
    or to_regprocedure('public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb)') is null then
    raise exception 'ElevenLabs voice foundation and existing credit RPC must be installed before receipt recovery';
  end if;
end$$;

-- Do not depend on the project's changing default table grants. These are the
-- existing server adapter's required operations, never browser-role access.
grant select,insert,update on public.elevenlabs_voice_calls,public.elevenlabs_voice_webhook_events to service_role;

create function public.apply_elevenlabs_voice_receipt(
  p_event_key text, p_payload jsonb, p_organization_id uuid, p_agent_id uuid,
  p_provider_agent_id text, p_call_id text, p_projection jsonb,
  p_credit_amount integer, p_plan_code text, p_provider_cost_cents numeric
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  receipt public.elevenlabs_voice_webhook_events%rowtype;
  voice_call public.elevenlabs_voice_calls%rowtype;
  conversation uuid;
  conversation_agent uuid;
  duration integer := (p_projection->>'duration_seconds')::integer;
  transfer_failed boolean := (p_projection->>'transfer_failed')::boolean;
  current_plan text;
  hint text;
begin
  if nullif(btrim(p_event_key),'') is null or nullif(btrim(p_call_id),'') is null
    or nullif(btrim(p_provider_agent_id),'') is null or p_organization_id is null or p_agent_id is null
    or jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_projection) is distinct from 'object'
    or duration is null or duration < 0 or transfer_failed is null
    or p_credit_amount is null or p_credit_amount < 0
    or p_provider_cost_cents is null or p_provider_cost_cents < 0 then
    raise exception 'Invalid voice receipt';
  end if;

  -- A transaction owns the row lock until every effect commits or rolls back.
  -- A disconnected/aborted transaction releases its lock without a stale lease.
  select * into strict receipt from public.elevenlabs_voice_webhook_events
    where event_key=p_event_key for update;
  if receipt.payload is distinct from p_payload or receipt.conversation_id is distinct from p_call_id
    or receipt.event_type is distinct from (p_projection->>'event_type')
    or (receipt.organization_id is not null and receipt.organization_id <> p_organization_id) then
    raise exception 'Receipt identity changed';
  end if;
  if receipt.processed_at is not null then
    return jsonb_build_object('ok',true,'duplicate',true,'event_key',p_event_key);
  end if;

  -- Different provider event keys for one call must share a settlement boundary.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('elevenlabs:'||p_call_id,0));
  -- Hold the validated mapping through commit; configuration changes must not
  -- overtake the server's tenant-binding check during settlement.
  perform 1 from public.agents where id=p_agent_id and organization_id=p_organization_id
    and configuration->>'elevenlabs_agent_id'=p_provider_agent_id for share;
  if not found then raise exception 'Voice agent mapping changed or is ambiguous'; end if;
  if (select count(*) from public.agents where configuration->>'elevenlabs_agent_id'=p_provider_agent_id) <> 1
    or not exists(select 1 from public.agents where id=p_agent_id and organization_id=p_organization_id
      and configuration->>'elevenlabs_agent_id'=p_provider_agent_id) then
    raise exception 'Voice agent mapping changed or is ambiguous';
  end if;
  if coalesce(nullif(btrim(p_payload#>>'{data,agent_id}'),''),nullif(btrim(p_payload#>>'{data,agentId}'),''),
      nullif(btrim(p_payload->>'agent_id'),''),nullif(btrim(p_payload->>'agentId'),'')) is distinct from p_provider_agent_id
    or coalesce(nullif(btrim(p_payload#>>'{data,conversation_id}'),''),nullif(btrim(p_payload#>>'{data,conversationId}'),''),
      nullif(btrim(p_payload->>'conversation_id'),''),nullif(btrim(p_payload->>'conversationId'),'')) is distinct from p_call_id then
    raise exception 'Provider identity does not match receipt';
  end if;
  for hint in select btrim(value) from (values
    (p_payload#>>'{data,metadata,organization_id}'),(p_payload#>>'{data,metadata,organizationId}'),
    (p_payload#>>'{metadata,organization_id}'),(p_payload#>>'{metadata,organizationId}'),
    (p_payload#>>'{data,organization_id}'),(p_payload#>>'{data,organizationId}'),
    (p_payload->>'organization_id'),(p_payload->>'organizationId')) hints(value)
    where nullif(btrim(value),'') is not null loop
    if lower(hint) <> p_organization_id::text then raise exception 'Organization hint conflicts with provider binding'; end if;
  end loop;
  if exists(select 1 from public.elevenlabs_voice_calls where conversation_id=p_call_id and organization_id<>p_organization_id) then
    raise exception 'Provider conversation already belongs to another organization';
  end if;

  insert into public.agent_conversations(organization_id,agent_id,channel,external_thread_key,status,ai_paused,last_message_at,metadata)
    values(p_organization_id,p_agent_id,'voice','elevenlabs:'||p_call_id,
      case when transfer_failed then 'human_handoff' else 'closed' end,transfer_failed,now(),
      jsonb_build_object('provider','elevenlabs','conversation_id',p_call_id,'event_type',receipt.event_type))
    on conflict (organization_id,channel,external_thread_key) do nothing;
  select id,agent_id into strict conversation,conversation_agent from public.agent_conversations
    where organization_id=p_organization_id and channel='voice' and external_thread_key='elevenlabs:'||p_call_id for update;
  if conversation_agent <> p_agent_id then raise exception 'Conversation agent binding changed'; end if;
  if transfer_failed then
    update public.agent_conversations set status='human_handoff',ai_paused=true
      where id=conversation and organization_id=p_organization_id and status<>'archived';
  end if;

  insert into public.elevenlabs_voice_calls(organization_id,agent_id,conversation_id,elevenlabs_agent_id,
    elevenlabs_version_id,direction,status,duration_seconds,transfer_status,caller_phone,transcript,summary,analysis,raw_payload)
  values(p_organization_id,p_agent_id,p_call_id,p_provider_agent_id,p_projection->>'version_id',
    p_projection->>'direction',p_projection->>'status',duration,p_projection->>'transfer_status',
    p_projection->>'caller_phone',p_projection->>'transcript',p_projection->>'summary',
    coalesce(p_projection->'analysis','{}'),p_payload)
  on conflict (organization_id,conversation_id) do update set
    status=case when elevenlabs_voice_calls.status in ('transfer_failed','handoff_required') then elevenlabs_voice_calls.status else excluded.status end,
    duration_seconds=greatest(elevenlabs_voice_calls.duration_seconds,excluded.duration_seconds),
    elevenlabs_version_id=coalesce(nullif(excluded.elevenlabs_version_id,''),elevenlabs_voice_calls.elevenlabs_version_id),
    transcript=coalesce(excluded.transcript,elevenlabs_voice_calls.transcript),
    summary=coalesce(excluded.summary,elevenlabs_voice_calls.summary),
    analysis=case when excluded.analysis='{}'::jsonb then elevenlabs_voice_calls.analysis else excluded.analysis end,
    raw_payload=excluded.raw_payload,
    transfer_status=case when elevenlabs_voice_calls.transfer_status='failed' then 'failed' else excluded.transfer_status end,
    updated_at=now()
  returning * into voice_call;
  if voice_call.agent_id <> p_agent_id or voice_call.elevenlabs_agent_id is distinct from p_provider_agent_id then
    raise exception 'Call agent binding changed';
  end if;

  if transfer_failed and not exists(select 1 from public.handoff_requests
    where organization_id=p_organization_id and conversation_id=conversation) then
    insert into public.handoff_requests(organization_id,conversation_id,agent_id,reason,priority,status,notes)
      values(p_organization_id,conversation,p_agent_id,'ElevenLabs human transfer failed or was unavailable.','high','open',
        format('ElevenLabs conversation %s. Caller: %s. Summary: %s',p_call_id,
          coalesce(p_projection->>'caller_phone','unknown'),coalesce(p_projection->>'summary','No summary available.')));
  end if;

  if voice_call.metered_at is null and voice_call.duration_seconds>0 then
    if duration <> voice_call.duration_seconds then raise exception 'Call duration changed; recheck the quote'; end if;
    if p_credit_amount<=0 or p_plan_code is null then raise exception 'A verified voice usage quote is required'; end if;
    select plan_code into strict current_plan from public.flux_credit_wallets
      where organization_id=p_organization_id for update;
    if current_plan is distinct from p_plan_code then raise exception 'Wallet plan changed; recheck feature access'; end if;
    -- Existing commercial function remains authoritative. Its debit/ledger and
    -- our metered marker/receipt completion share this transaction.
    perform public.record_flux_credit_usage(p_organization_id,'leo_voice_minute',p_credit_amount,
      'elevenlabs_voice_call','elevenlabs',p_provider_cost_cents,
      jsonb_build_object('duration_seconds',duration,'duration_minutes',greatest(1,ceil(duration/60.0)::integer),'conversation_id',p_call_id),
      jsonb_build_object('conversation_id',p_call_id,'agent_id',p_agent_id,'event_key',p_event_key,
        'transfer_failed',transfer_failed,'model',null,'input_tokens',null,'output_tokens',null,'total_tokens',null));
    update public.elevenlabs_voice_calls set flux_credits_charged=p_credit_amount,metered_at=now(),updated_at=now()
      where id=voice_call.id returning * into voice_call;
  end if;
  update public.elevenlabs_voice_webhook_events set organization_id=p_organization_id,processed_at=now(),processing_error=null
    where id=receipt.id;
  return jsonb_build_object('ok',true,'duplicate',false,'event_key',p_event_key,'organization_id',p_organization_id,
    'conversation_id',p_call_id,'call_status',voice_call.status,'transfer_failed',voice_call.status in ('transfer_failed','handoff_required'),
    'duration_seconds',voice_call.duration_seconds,'flux_credits_charged',voice_call.flux_credits_charged);
end;
$$;

revoke all on function public.apply_elevenlabs_voice_receipt(text,jsonb,uuid,uuid,text,text,jsonb,integer,text,numeric)
  from public,anon,authenticated;
grant execute on function public.apply_elevenlabs_voice_receipt(text,jsonb,uuid,uuid,text,text,jsonb,integer,text,numeric)
  to service_role;
commit;
