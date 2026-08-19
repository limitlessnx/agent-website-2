do $$
declare
  v_org_id uuid;
  v_agent_id uuid;
  v_project_id uuid;
  model_row record;
begin
  insert into organizations(name,slug,status,metadata)
  values ('Limitless Realty','limitless-realty','active',jsonb_build_object('brand','Limitless Realty','route','limitless-realty','human_handoff_whatsapp','2348127753308','property_catalog','properties'))
  on conflict (slug) do update set status='active',metadata=organizations.metadata || excluded.metadata,updated_at=now()
  returning id into v_org_id;
  if v_org_id is null then select o.id into v_org_id from organizations o where o.slug='limitless-realty'; end if;

  insert into projects(organization_id,agent_family_id,name,slug,description,status,metadata)
  values(v_org_id,'78defd19-55cc-4554-93aa-03e55f1177d2','Limitless Realty Maia','limitless-realty-maia','Limitless Realty agentic Maia runtime','active',jsonb_build_object('agentic',true))
  on conflict do nothing
  returning id into v_project_id;
  if v_project_id is null then select p.id into v_project_id from projects p where p.organization_id=v_org_id and p.slug='limitless-realty-maia'; end if;

  select a.id into v_agent_id from agents a where a.project_id=v_project_id and a.slug='maia' limit 1;
  if v_agent_id is null then
    insert into agents(organization_id,agent_family_id,project_id,name,slug,description,system_prompt,status,current_version,configuration,agent_type,ai_model,temperature,language,communication_channels,escalation_rules,human_handoff_destination,knowledge_sources)
    values(v_org_id,'78defd19-55cc-4554-93aa-03e55f1177d2',v_project_id,'Maia','maia','Limitless Realty agentic real-estate intelligence agent','You are Maia, the agentic real-estate intelligence agent for Limitless Realty. Use verified Limitless Realty property data and approved knowledge. For budgets, prioritize properties at or below the client budget and may suggest relevant options up to 20% above budget, clearly labeling them as above-budget alternatives. Never invent property availability, pricing, title status or documentation. Qualify prospects, maintain context, schedule follow-ups when requested, and hand over to the human agent when needed. Before any human handoff, provide the human agent with a concise conversation summary and only claim handoff completion after delivery is confirmed.','published',1,jsonb_build_object('brand','Limitless Realty','agentic_intelligence',true,'property_budget_tolerance_percent',20,'human_handoff_whatsapp','2348127753308'),'real_estate','gpt-5.6-luna',0.2,'English','["whatsapp","web","telegram","voice"]'::jsonb,'[{"type":"human_handoff","destination":"2348127753308"}]'::jsonb,jsonb_build_object('channel','whatsapp','destination','2348127753308','summary_before_handoff',true,'require_delivery_confirmation',true),'[{"type":"properties","table":"properties"},{"type":"knowledge","table":"knowledge_sources"}]'::jsonb)
    returning id into v_agent_id;
  end if;

  insert into organization_agent_selections(organization_id,agent_key,display_name,configuration,status,setup_price,monthly_price,currency)
  values(v_org_id,'whatsapp_agent','Maia',jsonb_build_object('provisioned_agent_id',v_agent_id,'role','primary_agentic_orchestrator','internal_agent','maia','channels',jsonb_build_array('whatsapp','web','telegram','voice')),'active',0,0,'NGN')
  on conflict do nothing;

  insert into agent_runtime_profiles(organization_id,agent_id,enabled,autonomy_mode,max_steps,model_strategy,memory_enabled,tool_policy)
  values(v_org_id,v_agent_id,true,'autonomous',12,'best_available',true,'{}'::jsonb)
  on conflict do nothing;

  for model_row in select m.id from ai_model_catalog m where m.provider='openai' and m.status='active' loop
    insert into organization_ai_model_assignments(organization_id,model_id,settings)
    values(v_org_id,model_row.id,jsonb_build_object('role','maia','enabled',true,'selection','agentic'))
    on conflict do nothing;
  end loop;

  insert into organization_follow_up_policies(organization_id,name,status,timezone,preferred_send_time,qualification,sequence,stop_conditions,channel_policy,message_strategy)
  values(v_org_id,'Limitless Realty Maia Follow-up','active','Africa/Lagos','10:30:00','{"require_explicit_interest":true}'::jsonb,'[{"stage":1,"delay_hours":24},{"stage":2,"delay_hours":72},{"stage":3,"delay_hours":168}]'::jsonb,'["opted_out","human_handoff","resolved","unresponsive_after_stage_3"]'::jsonb,'{"preferred":["whatsapp","web","telegram","voice"]}'::jsonb,'{"tone":"professional","reference_catalog":true,"avoid_repeating_questions":true}'::jsonb)
  on conflict do nothing;
end $$;

alter table public.follow_ups add column if not exists organization_id uuid references public.organizations(id);
create index if not exists follow_ups_organization_scheduled_idx on public.follow_ups(organization_id, scheduled_at, status);
