create or replace function public.prepare_onboarding_delivery(p_onboarding_id uuid, p_actor_email text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_submission public.client_onboarding_submissions%rowtype;
  v_org public.organizations%rowtype;
  v_project_id uuid;
  v_collection_id uuid;
  v_model_key text;
  v_agent_count integer := 0;
  v_workflow_count integer := 0;
  v_source_id uuid;
  v_business_name text;
  v_services text;
  v_requirements text;
begin
  select * into v_submission from public.client_onboarding_submissions where id = p_onboarding_id;
  if not found then raise exception 'Onboarding record not found'; end if;
  if v_submission.organization_id is null then raise exception 'Provision an organization first'; end if;

  select * into v_org from public.organizations where id = v_submission.organization_id;
  if not found then raise exception 'Linked organization not found'; end if;

  select p.id into v_project_id
  from public.projects p
  where p.organization_id = v_org.id
  order by p.created_at asc
  limit 1;

  if v_project_id is null then
    raise exception 'Complete client setup first: provision a business template or save an agent allocation so this organization has a project.';
  end if;

  if not exists (select 1 from public.agents where organization_id = v_org.id) then
    raise exception 'Complete client setup first: allocate and provision at least one agent before final workspace preparation.';
  end if;

  select am.model_key into v_model_key
  from public.organization_ai_model_assignments oa
  join public.ai_model_catalog am on am.id = oa.model_id
  where oa.organization_id = v_org.id
    and am.status = 'active'
  order by oa.assigned_at desc nulls last
  limit 1;

  v_business_name := coalesce(nullif(v_submission.business_information->>'businessName',''), v_org.name);
  v_services := coalesce(v_submission.business_services::text,'{}');
  v_requirements := coalesce(v_submission.automation_requirements::text,'{}');

  update public.agents
  set system_prompt = format('You are an approved AI assistant for %s. Answer only from approved organization knowledge. Never guess. Explain products and services accurately, qualify intent, collect useful details, and escalate whenever human approval or information is required.', v_business_name),
      ai_model = coalesce(v_model_key, ai_model),
      configuration = coalesce(configuration,'{}'::jsonb) || jsonb_build_object(
        'onboarding_id', p_onboarding_id,
        'business_services', v_submission.business_services,
        'communication_details', v_submission.communication_details,
        'automation_requirements', v_submission.automation_requirements,
        'prepared_at', now()
      ),
      updated_at = now()
  where organization_id = v_org.id;
  get diagnostics v_agent_count = row_count;

  update public.workflow_registry
  set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'onboarding_id', p_onboarding_id,
        'automation_requirements', v_submission.automation_requirements,
        'prepared_at', now()
      ),
      updated_at = now()
  where organization_uuid = v_org.id;
  get diagnostics v_workflow_count = row_count;

  select id into v_collection_id
  from public.knowledge_collections
  where organization_id = v_org.id
  order by created_at asc
  limit 1;

  if v_collection_id is null then
    insert into public.knowledge_collections(organization_id,name,slug,description,status,metadata)
    values(v_org.id,'Business Overview','business-overview','Core client onboarding knowledge.','active',jsonb_build_object('onboarding_id',p_onboarding_id))
    returning id into v_collection_id;
  end if;

  select id into v_source_id
  from public.knowledge_sources
  where organization_id = v_org.id and metadata->>'onboarding_id' = p_onboarding_id::text
  limit 1;

  if v_source_id is null then
    insert into public.knowledge_sources(organization_id,collection_id,title,source_type,content,status,metadata)
    values(
      v_org.id,
      v_collection_id,
      v_business_name || ' onboarding brief',
      'text',
      concat('Business information: ',v_submission.business_information::text,E'\n','Business and services: ',v_services,E'\n','Communication details: ',v_submission.communication_details::text,E'\n','Automation requirements: ',v_requirements,E'\n','Business resources: ',v_submission.business_resources::text),
      'ready',
      jsonb_build_object('onboarding_id',p_onboarding_id,'generated_by','delivery_preparation')
    ) returning id into v_source_id;
  end if;

  update public.organization_deployment_tasks
  set status='completed', completed_at=now(), completed_by=p_actor_email, updated_at=now()
  where onboarding_id=p_onboarding_id and task_key in ('configure_agent','prepare_knowledge');

  insert into public.client_delivery_notifications(onboarding_id,organization_id,recipient_email,notification_type,subject,body,status,metadata)
  values(
    p_onboarding_id,
    v_org.id,
    v_submission.purchaser_email,
    'workspace_ready',
    v_business_name || ' workspace is ready',
    'Your Fluxknight workspace has been configured and is ready for access. The platform team will provide your secure login and final operating notes.',
    'draft',
    jsonb_build_object('organization_slug',v_org.slug,'prepared_at',now())
  )
  on conflict(onboarding_id,notification_type) do update set
    organization_id=excluded.organization_id,
    recipient_email=excluded.recipient_email,
    subject=excluded.subject,
    body=excluded.body,
    metadata=public.client_delivery_notifications.metadata || excluded.metadata,
    updated_at=now();

  insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(v_org.id,null,'onboarding.delivery_prepared','client_onboarding_submission',p_onboarding_id::text,jsonb_build_object('actor_email',p_actor_email,'agents_updated',v_agent_count,'workflows_updated',v_workflow_count,'knowledge_source_id',v_source_id));

  return jsonb_build_object('ok',true,'organization_id',v_org.id,'project_id',v_project_id,'agents_updated',v_agent_count,'workflows_updated',v_workflow_count,'knowledge_source_id',v_source_id,'notification_prepared',true);
end;
$function$;
