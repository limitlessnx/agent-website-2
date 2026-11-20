begin;

-- Replace only the verified outcome function. Existing service-role grants are preserved.
create or replace function public.persist_runtime_communication_outcome(
  p_organization_id uuid,p_agent_id uuid,p_execution_id uuid,p_workflow text,p_body jsonb,p_billing jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
<<outcome>>
declare
  e public.runtime_executions;
  w public.flux_credit_wallets;
  customer public.crm_customers;
  prior public.runtime_progress_events;
  input jsonb:=coalesce(p_body->'input','{}');
  d jsonb:=coalesce(p_body->'decision','{}');
  usage jsonb:=coalesce(p_body->'provider_usage','{}');
  key text:=btrim(coalesce(p_body->>'idempotency_key',''));
  customer_key text:=btrim(coalesce(p_body->>'customer_key',''));
  fingerprint text;
  receipt uuid:=gen_random_uuid();
  customer_id uuid; profile_id uuid; conversation_id uuid; lead_id uuid;
  conversation public.agent_conversations;
  channel text; source text; charge_action text; event_type text:=coalesce(p_body->>'event_type','');
  action text; reply_class text:=coalesce(d->>'reply_classification','');
  suppressed boolean:=false; handoff_required boolean:=false; terminal_call boolean:=false;
  lead_created boolean:=false;
  stage text; reply text; subject text; transcript text;
  follow_up jsonb:=null; handoff jsonb:=null; email_action jsonb:=null;
  actions jsonb:='[]'; result jsonb; task public.crm_tasks; h public.handoff_requests;
  ledger_id uuid; charge integer; cost numeric; quantity integer;
  reservation public.flux_credit_reservations;
  settlement jsonb; model_evidence jsonb; charge_metadata jsonb; charge_usage jsonb; charge_provider text;
  due_at timestamptz; memory jsonb; customer_input jsonb;
begin
  if p_workflow is null or p_workflow not in ('outbound_email_crm_v5','voice_receptionist_v6')
    or p_organization_id is null or p_agent_id is null or p_execution_id is null
    or jsonb_typeof(p_body) is distinct from 'object' or jsonb_typeof(input)<>'object' or jsonb_typeof(d)<>'object' or jsonb_typeof(usage)<>'object'
    or jsonb_typeof(p_billing) is distinct from 'object' or length(key) not between 1 and 512 or length(customer_key) not between 1 and 512
    or p_body->>'organization_id' is distinct from p_organization_id::text or p_body->>'agent_id' is distinct from p_agent_id::text or p_body->>'execution_id' is distinct from p_execution_id::text then
    raise exception 'outcome_scope_mismatch';
  end if;
  perform 1 from public.organizations where id=p_organization_id and status='active' for share;
  if not found then raise exception 'outcome_scope_mismatch'; end if;
  -- Serialize the same operation across executions as well as retries of one execution.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_workflow||':'||key,0));
  select * into e from public.runtime_executions where id=p_execution_id and organization_id=p_organization_id and agent_id=p_agent_id for update;
  if e.id is null or not exists(select 1 from public.agents where id=p_agent_id and organization_id=p_organization_id) then raise exception 'outcome_scope_mismatch'; end if;
  if p_workflow='voice_receptionist_v6' and e.input->>'workflow_key'='outbound_email_crm_v5' then
    raise exception 'outcome_scope_mismatch';
  end if;
  if p_workflow='outbound_email_crm_v5' and (
    exists(select 1 from public.flux_credit_reservations r where r.organization_id=p_organization_id
      and r.idempotency_key='phase12-provider:'||p_execution_id::text and r.source<>'outbound_email_runtime')
    or exists(select 1 from public.flux_credit_ledger l where l.organization_id=p_organization_id
      and l.source='phase12_provider_runtime' and l.metadata->>'execution_id'=p_execution_id::text)
  ) then raise exception 'legacy_outcome_requires_review'; end if;
  fingerprint:=encode(sha256(convert_to(jsonb_build_object('workflow',p_workflow,'body',p_body)::text,'UTF8')),'hex');
  select * into prior from public.runtime_progress_events ev where ev.organization_id=p_organization_id and ev.execution_id=p_execution_id and ev.event_type='communication.outcome_committed' order by id limit 1;
  if prior.id is null then
    select * into prior from public.runtime_progress_events ev where ev.organization_id=p_organization_id and ev.event_type='communication.outcome_committed'
      and payload->>'workflow_key'=p_workflow and payload->>'idempotency_key'=key order by id limit 1;
  end if;
  if prior.id is not null then
    if prior.execution_id<>p_execution_id or prior.payload->>'workflow_key' is distinct from p_workflow or prior.payload->>'agent_id' is distinct from p_agent_id::text or prior.payload->>'idempotency_key' is distinct from key or prior.payload->>'request_fingerprint' is distinct from fingerprint then raise exception 'outcome_input_conflict'; end if;
    if jsonb_typeof(prior.payload->'result') is distinct from 'object' or jsonb_typeof(prior.payload->'credits') is distinct from 'number'
      or prior.payload->>'result_fingerprint' is distinct from encode(sha256(convert_to((prior.payload->'result')::text,'UTF8')),'hex')
      or not exists(select 1 from public.audit_logs a where a.organization_id=p_organization_id and a.action='runtime.communication_outcome_committed' and metadata->>'receipt_id'=prior.payload->>'receipt_id' and metadata->>'request_fingerprint'=fingerprint and metadata->>'result_fingerprint'=prior.payload->>'result_fingerprint')
      or ((prior.payload->>'credits')::integer>0 and not exists(select 1 from public.flux_credit_ledger where organization_id=p_organization_id and id=(prior.payload->>'ledger_id')::uuid and transaction_type='usage' and credit_delta=-(prior.payload->>'credits')::integer and metadata->>'runtime_outcome_receipt_id'=prior.payload->>'receipt_id')) then raise exception 'outcome_evidence_unavailable'; end if;
    -- Recover the original action intent; downstream queue idempotency prevents redispatch.
    return (prior.payload->'result')||jsonb_build_object('duplicate',true);
  end if;
  -- Historical partial writes are not completion proof. Never silently debit/replay them.
  if exists(select 1 from public.conversation_messages where organization_id=p_organization_id and payload->>'workflow_key'=p_workflow
      and (payload->>'execution_id'=p_execution_id::text or payload->>'idempotency_key' in (key,key||':decision',key||':reply',key||':outbound')))
    or exists(select 1 from public.flux_credit_ledger l where l.organization_id=p_organization_id and l.source in ('outbound_email_runtime','voice_receptionist_runtime') and (metadata->>'execution_id'=p_execution_id::text or metadata->>'idempotency_key'=key))
    or exists(select 1 from public.runtime_progress_events ev where ev.organization_id=p_organization_id and ev.execution_id=p_execution_id and ev.event_type in ('outbound_email.persisted','voice.outcome_persisted')) then raise exception 'legacy_outcome_requires_review'; end if;
  if e.status in ('cancelled','blocked','failed','succeeded') then raise exception 'outcome_scope_mismatch'; end if;

  channel:=case when p_workflow='outbound_email_crm_v5' then 'email' else 'voice' end;
  source:=case when channel='email' then 'outbound_email_runtime' else 'voice_receptionist_runtime' end;
  charge_action:=case when channel='voice' then 'leo_voice_minute' when (p_body->>'sequence_step')::numeric>1 or lower(event_type) like '%follow%' then 'email_follow_up' else 'ai_email' end;
  terminal_call:=channel='voice' and (lower(coalesce(d->>'call_status','')) in ('completed','ended','finished','hangup','hung_up') or lower(event_type) in ('voice.call_ended','voice.completed','call.ended'));
  charge:=(p_billing->>'credits')::integer; quantity:=(p_billing->>'quantity')::integer; cost:=(p_billing->>'provider_cost_cents')::numeric;
  if p_billing->>'action' is distinct from charge_action or charge is null or charge<0 or quantity is null or quantity<1 or cost is null or cost<0 or cost::text in ('NaN','Infinity','-Infinity') or coalesce((p_billing->>'preflight_credits')::integer,0)<=0
    or ((channel='email' or terminal_call) and charge<=0) or (channel='voice' and not terminal_call and charge<>0) then raise exception 'outcome_billing_changed'; end if;
  select * into w from public.flux_credit_wallets where organization_id=p_organization_id for update;
  if w.organization_id is null or w.plan_code is distinct from p_billing->>'plan_code' then raise exception 'outcome_billing_changed'; end if;
  if w.status<>'active' or w.trial_ends_at is not null then raise exception 'outcome_wallet_unavailable'; end if;
  if channel='email' then
    if e.input->>'workflow_key' is distinct from p_workflow or e.input->>'channel' is distinct from 'email'
      or not exists(select 1 from public.command_queue q where q.organization_id=p_organization_id and q.agent_id=p_agent_id
        and q.execution_id=p_execution_id and q.command_type='agent.respond' and q.idempotency_key=key)
      or e.input->>'customer_key' is distinct from customer_key
      or coalesce(e.input->>'email',e.input->>'recipient_email','') is distinct from coalesce(input->>'email',input->>'recipient_email','')
      or e.input->>'event_type' is distinct from event_type
      or coalesce((e.input->>'sequence_step')::numeric,1) is distinct from (p_body->>'sequence_step')::numeric
      or (e.input->>'customer_id') is distinct from (p_body->>'customer_id')
      or (e.input->>'lead_id') is distinct from (p_body->>'lead_id')
      or (e.input->>'campaign_id') is distinct from (p_body->>'campaign_id') then raise exception 'outcome_scope_mismatch'; end if;
    select * into reservation from public.flux_credit_reservations r
      where r.organization_id=p_organization_id and r.idempotency_key='phase12-provider:'||p_execution_id::text for update;
    if reservation.id is null or reservation.source<>'outbound_email_runtime'
      or reservation.status<>'held' or reservation.action_key<>charge_action or reservation.reserved_credits<>charge
      or quantity<>1 or charge<>(case when charge_action='email_follow_up' then 2 else 3 end) then
      raise exception 'outcome_evidence_unavailable';
    end if;
    select m.response_payload into model_evidence from public.runtime_model_requests m
      where m.organization_id=p_organization_id and m.execution_id=p_execution_id and m.status='succeeded'
      and m.response_payload->>'credit_reservation_id'=reservation.id::text
      and m.response_payload->>'credit_request_fingerprint'=reservation.request_fingerprint
      order by m.completed_at desc limit 1;
    if model_evidence is null or nullif(model_evidence->>'id','') is null
      or model_evidence->>'id' is distinct from p_body->>'provider_response_id'
      or not exists(select 1 from public.runtime_progress_events ev where ev.organization_id=p_organization_id
        and ev.execution_id=p_execution_id and ev.event_type='provider.completed'
        and ev.payload->>'credit_reservation_id'=reservation.id::text
        and ev.payload->>'credit_request_fingerprint'=reservation.request_fingerprint
        and ev.payload->>'provider_response_id'=model_evidence->>'id') then raise exception 'outcome_evidence_unavailable'; end if;
  elsif coalesce((public.get_flux_credit_availability(p_organization_id)->>'available')::bigint,-1)<greatest(charge,(p_billing->>'preflight_credits')::integer) then
    raise exception 'outcome_wallet_unavailable';
  end if;

  customer_id:=nullif(btrim(p_body->>'customer_id'),'')::uuid;
  if customer_id is not null then
    select * into customer from public.crm_customers where id=customer_id and organization_id=p_organization_id for update;
    if customer.id is null then raise exception 'outcome_scope_mismatch'; end if;
  else
    -- Keep the existing external-key customer lookup; lock this identity for simultaneous events.
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':runtime-customer:'||customer_key,0));
    select * into customer from public.crm_customers where organization_id=p_organization_id and external_key=customer_key for update;
    if customer.id is null then
      customer_input:=case when channel='voice' then coalesce(input->'customer','{}') else input end;
      insert into public.crm_customers(organization_id,external_key,full_name,email,phone,company_name,status,profile,metadata)
        values(p_organization_id,customer_key,coalesce(nullif(btrim(customer_input->>'full_name'),''),nullif(btrim(customer_input->>'name'),''),case when channel='email' then 'Unknown contact' else 'Unknown caller' end),
          nullif(coalesce(customer_input->>'email',input->>'recipient_email'),''),nullif(coalesce(customer_input->>'phone',input->>'caller_phone'),''),nullif(customer_input->>'company_name',''),'active',
          jsonb_build_object('preferred_channel',channel,'job_title',customer_input->>'job_title'),jsonb_build_object('created_by_workflow',p_workflow,'first_execution_id',p_execution_id)) returning * into customer;
    end if;
    customer_id:=customer.id;
  end if;
  if customer.external_key is not null and customer.external_key<>customer_key then raise exception 'outcome_scope_mismatch'; end if;
  -- Conversations reference legacy customer_profiles, not crm_customers. Preserve a
  -- verified existing profile if available; otherwise bind the canonical CRM ID in metadata.
  select id into profile_id from public.customer_profiles where organization_id=p_organization_id and (id=customer_id or (customer.external_key is not null and external_key=customer.external_key)) order by (id=customer_id) desc limit 1;
  conversation_id:=coalesce(nullif(btrim(p_body->>'conversation_id'),'')::uuid,e.conversation_id);
  if conversation_id is not null then
    select * into conversation from public.agent_conversations where id=conversation_id and organization_id=p_organization_id and agent_id=p_agent_id and agent_conversations.channel=outcome.channel for update;
    if conversation.id is null or (conversation.metadata ? 'crm_customer_id' and conversation.metadata->>'crm_customer_id'<>customer_id::text)
      or (conversation.customer_id is not null and conversation.customer_id is distinct from profile_id) then raise exception 'outcome_scope_mismatch'; end if;
  else
    insert into public.agent_conversations(organization_id,agent_id,customer_id,channel,status,current_stage,ai_paused,last_message_at,metadata)
      values(p_organization_id,p_agent_id,profile_id,channel,case when coalesce((d->>'handoff_required')::boolean,false) then 'human_handoff' else 'open' end,
      coalesce(nullif(d->>'lead_stage',''),case when channel='email' then 'nurturing' else 'new' end),coalesce((d->>'handoff_required')::boolean,false),now(),
      jsonb_build_object('workflow_key',p_workflow,'crm_customer_id',customer_id,'campaign_id',p_body->'campaign_id','call_id',input->'call_id','event_type',event_type)) returning id into conversation_id;
    update public.runtime_executions set conversation_id=outcome.conversation_id where id=p_execution_id and organization_id=p_organization_id;
  end if;
  lead_id:=case when channel='email' then nullif(btrim(p_body->>'lead_id'),'')::uuid else null end;
  if lead_id is not null then
    perform 1 from public.crm_leads where id=lead_id and organization_id=p_organization_id and crm_leads.customer_id=outcome.customer_id for update;
    if not found then raise exception 'outcome_scope_mismatch'; end if;
  else
    select id into lead_id from public.crm_leads where organization_id=p_organization_id and crm_leads.customer_id=outcome.customer_id order by updated_at desc limit 1 for update;
  end if;
  stage:=coalesce(nullif(d->>'lead_stage',''),case when channel='email' then 'nurturing' when lead_id is null then 'new' else 'contacted' end);
  if lead_id is null then
    insert into public.crm_leads(organization_id,customer_id,assigned_agent_id,source,stage,score,summary,details)
    values(p_organization_id,customer_id,p_agent_id,case when channel='email' then 'outbound_email' else 'voice' end,stage,coalesce((d->>'qualification_score')::numeric,0),coalesce(d->>'summary',input->>'campaign_name',case when channel='voice' then 'Voice interaction' else 'Outbound email prospect' end),jsonb_build_object('execution_id',p_execution_id,'call_id',input->'call_id','intent',d->'intent','department',d->'department','sentiment',d->'sentiment','crm_notes',d->'crm_notes')) returning id into lead_id;
    lead_created:=true;
  end if;

  suppressed:=coalesce((customer.profile->>'opted_out')::boolean,false) or coalesce((customer.metadata->>'opted_out')::boolean,false) or coalesce((customer.metadata->>'do_not_contact')::boolean,false) or coalesce((customer.metadata->>'email_bounced')::boolean,false) or customer.status in ('inactive','blocked','archived') or reply_class in ('unsubscribe','bounce');
  action:=case when channel='email' and suppressed then 'stop' else coalesce(nullif(d->>'action',''),case when channel='email' then 'skip' else '' end) end;
  handoff_required:=coalesce((d->>'handoff_required')::boolean,false) or action='handoff';
  if channel='email' then
    insert into public.conversation_messages(organization_id,conversation_id,sender_type,content_type,content,payload)
    values(p_organization_id,conversation_id,'system','workflow_decision',coalesce(d->>'reason','Outbound email decision: '||action),jsonb_build_object('workflow_key',p_workflow,'execution_id',p_execution_id,'idempotency_key',key,'action',action,'event_type',event_type,'campaign_id',p_body->'campaign_id','sequence_step',p_body->'sequence_step','reply_classification',reply_class,'suppressed',suppressed));
    update public.crm_leads set stage=outcome.stage,details=details||jsonb_build_object('workflow_key',p_workflow,'campaign_id',p_body->'campaign_id','sequence_step',p_body->'sequence_step','action',action,'reason',d->'reason','reply_classification',reply_class,'next_send_at',d->'next_send_at','stop_sequence',coalesce((d->>'stop_sequence')::boolean,false) or suppressed,'last_execution_id',p_execution_id),updated_at=now() where id=lead_id and organization_id=p_organization_id;
    if reply_class in ('unsubscribe','bounce') then
      -- The supported CRM lifecycle uses inactive; suppression remains explicit metadata.
      update public.crm_customers set status='inactive',metadata=metadata||jsonb_build_object('opted_out',reply_class='unsubscribe','do_not_contact',reply_class='unsubscribe','email_bounced',reply_class='bounce','suppression_source',p_workflow,'suppression_execution_id',p_execution_id),updated_at=now() where id=customer_id and organization_id=p_organization_id;
    end if;
    due_at:=nullif(d->>'next_send_at','')::timestamptz;
    if not suppressed and not coalesce((d->>'stop_sequence')::boolean,false) and due_at is not null and action in ('send','reschedule') then
      insert into public.crm_tasks(organization_id,customer_id,lead_id,assigned_agent_id,task_type,title,description,status,due_at,metadata)
      values(p_organization_id,customer_id,lead_id,p_agent_id,'outbound_email_sequence','Outbound email step '||(d->>'next_step'),coalesce(d->>'reason','Continue outbound email sequence.'),'scheduled',due_at,jsonb_build_object('workflow_key',p_workflow,'campaign_id',p_body->'campaign_id','sequence_step',d->'next_step','source_execution_id',p_execution_id,'idempotency_key',key||':next')) returning * into task;
      follow_up:=jsonb_build_object('id',task.id,'status',task.status,'due_at',task.due_at);
    end if;
    subject:=coalesce(d->>'subject',''); reply:=coalesce(d->>'message','');
    if action='send' and subject<>'' and reply<>'' and not suppressed then email_action:=jsonb_build_object('type','reply','channel','email','recipient',coalesce(nullif(input->>'email',''),nullif(input->>'recipient_email',''),customer.email,''),'subject',subject,'content',reply,'conversation_id',conversation_id,'customer_id',customer_id,'lead_id',lead_id,'campaign_id',p_body->'campaign_id','sequence_step',p_body->'sequence_step'); end if;
    if subject<>'' or reply<>'' then
      insert into public.conversation_messages(organization_id,conversation_id,sender_type,sender_id,content_type,content,payload)
      values(p_organization_id,conversation_id,'agent',p_agent_id,'email',coalesce(nullif(reply,''),subject),jsonb_build_object('workflow_key',p_workflow,'execution_id',p_execution_id,'idempotency_key',key||':outbound','subject',subject,'recipient',coalesce(input->>'email',input->>'recipient_email',customer.email),'dispatch_requested',email_action is not null,'suppressed',suppressed));
    end if;
  else
    transcript:=coalesce(nullif(input->>'transcript',''),input->>'latest_transcript',''); reply:=coalesce(d->>'reply_text','');
    if transcript<>'' then insert into public.conversation_messages(organization_id,conversation_id,sender_type,content_type,content,payload) values(p_organization_id,conversation_id,'customer','voice_transcript',transcript,jsonb_build_object('workflow_key',p_workflow,'execution_id',p_execution_id,'idempotency_key',key,'call_id',input->'call_id','event_type',event_type,'direction',coalesce(input->>'direction','inbound'))); end if;
    if reply<>'' then insert into public.conversation_messages(organization_id,conversation_id,sender_type,sender_id,content_type,content,payload) values(p_organization_id,conversation_id,'agent',p_agent_id,'voice_reply',reply,jsonb_build_object('workflow_key',p_workflow,'execution_id',p_execution_id,'idempotency_key',key||':reply','call_id',input->'call_id','event_type',event_type)); end if;
    insert into public.conversation_messages(organization_id,conversation_id,sender_type,content_type,content,payload) values(p_organization_id,conversation_id,'system','workflow_decision',coalesce(d->>'summary','Voice event processed.'),jsonb_build_object('workflow_key',p_workflow,'execution_id',p_execution_id,'idempotency_key',key||':decision','event_type',event_type,'action',action,'call_status',d->'call_status','intent',d->'intent','priority',d->'priority','qualification_score',d->'qualification_score'));
    if not lead_created then
    update public.crm_leads set stage=outcome.stage,score=coalesce((d->>'qualification_score')::numeric,0),summary=coalesce(d->>'summary','Voice interaction'),details=details||jsonb_build_object('last_voice_execution_id',p_execution_id,'last_call_id',input->'call_id','intent',d->'intent','department',d->'department','sentiment',d->'sentiment','crm_notes',d->'crm_notes'),updated_at=now() where id=lead_id and organization_id=p_organization_id;
    end if;
    if reply<>'' and d->>'call_status'='in_progress' then actions:=actions||jsonb_build_array(jsonb_build_object('type','reply','payload',jsonb_build_object('channel','voice','recipient',coalesce(input->>'caller_phone',customer_key),'content',reply,'conversation_id',conversation_id,'customer_id',customer_id,'lead_id',lead_id,'call_id',input->'call_id'))); end if;
    if coalesce((d->>'appointment_requested')::boolean,false) then actions:=actions||jsonb_build_array(jsonb_build_object('type','appointment','payload',coalesce(d->'appointment_details','{}')||jsonb_build_object('customer_id',customer_id,'lead_id',lead_id,'conversation_id',conversation_id,'source','voice','call_id',input->'call_id'))); end if;
    if coalesce((d->>'follow_up_required')::boolean,false) then
      due_at:=coalesce(nullif(d->>'follow_up_at','')::timestamptz,now()+interval '24 hours');
      insert into public.crm_tasks(organization_id,customer_id,lead_id,assigned_agent_id,task_type,title,description,status,due_at,metadata)
      values(p_organization_id,customer_id,lead_id,p_agent_id,'voice_follow_up','Voice call follow-up',coalesce(d->>'follow_up_reason',d->>'summary','Follow up after voice interaction.'),'scheduled',due_at,jsonb_build_object('workflow_key',p_workflow,'source_execution_id',p_execution_id,'call_id',input->'call_id','idempotency_key',key||':followup')) returning * into task;
      actions:=actions||jsonb_build_array(jsonb_build_object('type','follow_up','payload',jsonb_build_object('task_id',task.id,'due_at',task.due_at,'customer_id',customer_id,'lead_id',lead_id)));
    end if;
    for memory in select value from jsonb_array_elements(case when jsonb_typeof(d->'memory_facts')='array' then d->'memory_facts' else '[]' end) loop
      if btrim(coalesce(memory->>'summary',''))<>'' then insert into public.customer_memories(organization_id,customer_key,memory_type,summary,confidence,source_type,source_id,metadata) values(p_organization_id,customer_key,coalesce(nullif(memory->>'type',''),'voice'),memory->>'summary',greatest(0,least(1,coalesce((memory->>'confidence')::numeric,0.8))),'runtime_execution',p_execution_id::text,jsonb_build_object('agent_id',p_agent_id,'conversation_id',conversation_id,'lead_id',lead_id,'call_id',input->'call_id','workflow_key',p_workflow)); end if;
    end loop;
  end if;
  if handoff_required then
    insert into public.handoff_requests(organization_id,conversation_id,agent_id,reason,priority,status,notes) values(p_organization_id,conversation_id,p_agent_id,coalesce(d->>'handoff_reason',d->>'reason',d->>'summary','Human review required.'),case when d->>'priority' in ('urgent','high') then d->>'priority' else 'normal' end,'open',case when channel='voice' then 'Call '||coalesce(nullif(input->>'call_id',''),'unknown')||'; execution '||p_execution_id::text else 'Execution '||p_execution_id::text end) returning * into h;
    handoff:=jsonb_build_object('id',h.id,'status',h.status,'priority',h.priority,'reason',h.reason);
    update public.agent_conversations set status='human_handoff',ai_paused=true,updated_at=now() where id=conversation_id and organization_id=p_organization_id;
    if channel='voice' then actions:=actions||jsonb_build_array(jsonb_build_object('type','handoff','payload',jsonb_build_object('handoff_id',h.id,'conversation_id',conversation_id,'customer_id',customer_id,'lead_id',lead_id))); end if;
  end if;
  if channel='email' or usage<>'{}'::jsonb then
    insert into public.usage_ledger(organization_id,agent_id,execution_id,usage_type,quantity,unit_cost_minor,metadata) values(p_organization_id,p_agent_id,p_execution_id,'ai_tokens',greatest(0,coalesce((usage->>'total_tokens')::numeric,(usage->>'total')::numeric,0)),0,jsonb_build_object('workflow_key',p_workflow,'provider_response_id',p_body->'provider_response_id','runtime_outcome_receipt_id',receipt));
  end if;
  if charge>0 then
    charge_metadata:=jsonb_build_object('runtime_outcome_receipt_id',receipt,'agent_id',p_agent_id,'execution_id',p_execution_id,'idempotency_key',key,'call_id',input->'call_id','campaign_id',p_body->'campaign_id','sequence_step',p_body->'sequence_step','model',coalesce(model_evidence->>'model',p_body->>'model'));
    charge_usage:=jsonb_strip_nulls(jsonb_build_object('inputTokens',usage->'input_tokens','outputTokens',usage->'output_tokens','totalTokens',coalesce(usage->'total_tokens',usage->'total')));
    if channel='email' then
      settlement:=public.finish_flux_credit_capacity(p_organization_id,reservation.id,'settled','communication_outcome_committed',
        model_evidence->>'provider',cost,charge_usage,charge_metadata);
      if settlement->>'status' is distinct from 'settled' then raise exception 'outcome_wallet_unavailable'; end if;
    else
      charge_provider:=coalesce(nullif(input->>'provider',''),nullif(p_body->>'provider',''));
      charge_usage:=charge_usage||jsonb_build_object('billableMinutes',quantity,'durationSeconds',p_billing->'duration_seconds','durationEvidence',p_billing->'duration_evidence');
      perform public.record_flux_credit_usage(p_organization_id,charge_action,charge,source,charge_provider,cost,charge_usage,charge_metadata);
    end if;
    select id into ledger_id from public.flux_credit_ledger where organization_id=p_organization_id and metadata->>'runtime_outcome_receipt_id'=receipt::text;
    if ledger_id is null then raise exception 'outcome_evidence_unavailable'; end if;
  end if;
  result:=jsonb_build_object('ok',true,'organization_id',p_organization_id,'agent_id',p_agent_id,'execution_id',p_execution_id,'conversation_id',conversation_id,'customer_id',customer_id,'lead_id',lead_id,'idempotency_key',key,'handoff',handoff);
  if channel='email' then result:=result||jsonb_build_object('campaign_id',p_body->'campaign_id','sequence_step',p_body->'sequence_step','action',action,'suppressed',suppressed,'reply_classification',nullif(reply_class,''),'email_action',email_action,'follow_up',follow_up);
  else result:=result||jsonb_build_object('event_type',event_type,'call_id',input->'call_id','call_status',coalesce(nullif(d->>'call_status',''),'in_progress'),'summary',coalesce(d->>'summary',''),'reply_text',nullif(reply,''),'actions',actions); end if;
  insert into public.runtime_progress_events(organization_id,execution_id,event_type,message,payload) values(p_organization_id,p_execution_id,'communication.outcome_committed','Communication outcome and billing committed; delivery is separate.',jsonb_build_object('receipt_id',receipt,'workflow_key',p_workflow,'agent_id',p_agent_id,'idempotency_key',key,'request_fingerprint',fingerprint,'credits',charge,'ledger_id',ledger_id,'result_fingerprint',encode(sha256(convert_to(result::text,'UTF8')),'hex'),'result',result));
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,reason,metadata) values(p_organization_id,'runtime.communication_outcome_committed','runtime_execution',p_execution_id::text,'Authenticated runtime persistence; no provider dispatch in this transaction',jsonb_build_object('actor_type','runtime_gateway','agent_id',p_agent_id,'execution_id',p_execution_id,'receipt_id',receipt,'workflow_key',p_workflow,'credits',charge,'ledger_id',ledger_id,'request_fingerprint',fingerprint,'result_fingerprint',encode(sha256(convert_to(result::text,'UTF8')),'hex'),'outcome','committed'));
  return result;
end $fn$;

commit;
