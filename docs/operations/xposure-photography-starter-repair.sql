-- Operator-run data repair, NOT a migration or a deployment hook.
-- Explicit user request: correct Xposure's Photography setup, preserving live Maia.
-- Reuses the existing provisioner. No external deployment, communication or activation.
do $repair$
declare
  org_id constant uuid := '55fd36ae-1e16-4cf1-a8ba-dd694a67f876';
  old_assignment_id constant uuid := '4af9cafa-67f0-4520-b8ce-4c4beb1831e1';
  old_template_id constant uuid := '03db0791-47cf-48e5-be28-555614a45de8';
  new_template_id constant uuid := 'ab4f08cf-92fd-4965-bddb-4b54b7284230';
  repair_key constant text := 'xposure-photography-starter-20261120';
  result jsonb;
  prior_agents jsonb;
  prior_integrations jsonb;
  prior_knowledge jsonb;
  prior_workflows jsonb;
  prior_billing jsonb;
  current_billing jsonb;
  workflow_count integer;
  new_workflows integer;
  old_assignment public.organization_template_assignments%rowtype;
  next_assignment public.organization_template_assignments%rowtype;
begin
  perform set_config('lock_timeout','3s',true);
  perform set_config('statement_timeout','30s',true);
  perform 1 from public.organizations where id=org_id and name='Xposure' and slug='xposure' and status='active' for update;
  if not found then raise exception 'Xposure identity or lifecycle changed'; end if;
  if not exists(select 1 from public.client_onboarding_profiles where organization_id=org_id and industry='photography-studio' and status='configuration') then
    raise exception 'Photography onboarding profile changed';
  end if;
  if exists(select 1 from public.audit_logs where organization_id=org_id and action='organization.industry_starter_repaired' and metadata->>'repair_key'=repair_key) then
    -- A replay never provisions another family or changes customer configuration.
    if not exists(select 1 from public.organization_template_assignments where organization_id=org_id and template_id=new_template_id and status='active') then raise exception 'Completed repair subsequently changed; review required'; end if;
    return;
  end if;
  select * into old_assignment from public.organization_template_assignments where organization_id=org_id and id=old_assignment_id and template_id=old_template_id and status='active' for update;
  if old_assignment.id is null then raise exception 'Expected Computer Service assignment changed'; end if;
  if exists(select 1 from public.organization_template_assignments where organization_id=org_id and id<>old_assignment_id) then raise exception 'Unexpected assignment history; review before repair'; end if;
  if not exists(select 1 from public.organization_templates where id=new_template_id and slug='photography-ai-suite' and industry='Photography Studio' and status='active') then raise exception 'Canonical Photography starter changed'; end if;

  perform 1 from public.agents where organization_id=org_id for update;
  perform 1 from public.organization_integrations where organization_id=org_id for update;
  perform 1 from public.knowledge_collections where organization_id=org_id for update;
  perform 1 from public.workflow_registry where organization_uuid=org_id for update;
  select coalesce(jsonb_object_agg(id::text,to_jsonb(a)),'{}') into prior_agents from public.agents a where organization_id=org_id;
  select coalesce(jsonb_object_agg(id::text,to_jsonb(i)),'{}') into prior_integrations from public.organization_integrations i where organization_id=org_id;
  select coalesce(jsonb_object_agg(id::text,to_jsonb(k)),'{}') into prior_knowledge from public.knowledge_collections k where organization_id=org_id;
  select coalesce(jsonb_object_agg(id::text,to_jsonb(w)),'{}') into prior_workflows from public.workflow_registry w where organization_uuid=org_id;
  select jsonb_build_object('wallet',(select to_jsonb(w) from public.flux_credit_wallets w where organization_id=org_id),'subscriptions',(select jsonb_agg(to_jsonb(s) order by id) from public.organization_subscriptions s where organization_id=org_id)) into prior_billing;

  result := public.provision_organization_template(org_id,'photography-ai-suite',null);
  select * into next_assignment from public.organization_template_assignments where organization_id=org_id and id=(result->>'assignment_id')::uuid and template_id=new_template_id and status='active' for update;
  if next_assignment.id is null then raise exception 'Photography starter did not complete'; end if;

  -- Normalize only rows newly inserted by this invocation; never move an existing
  -- tenant/customer workflow. The legacy namespace is unique per workflow key.
  update public.workflow_registry set organization_id=org_id::text
    where organization_uuid=org_id and project_uuid=(result->>'project_id')::uuid and status='draft'
      and organization_id='photography-ai-suite' and not (prior_workflows ? id::text);
  insert into public.workflow_registry(
    organization_id,project_id,organization_uuid,branch_id,agent_family_id,project_uuid,
    workflow_key,name,description,provider,trigger_type,environment,status,current_version,timeout_seconds,max_retries,metadata
  ) select org_id::text,'platform-starter',org_id,(result->>'branch_id')::uuid,(result->>'agent_family_id')::uuid,(result->>'project_id')::uuid,
    item.key,initcap(replace(item.key,'_',' ')),'Draft Photography starter workflow.','n8n','webhook','production','draft',1,60,2,
    jsonb_build_object('template_id',new_template_id,'template_slug','photography-ai-suite','repair_key',repair_key)
    from public.organization_templates t cross join lateral (select distinct value as key from jsonb_array_elements_text(t.workflows)) item
    where t.id=new_template_id and not exists(select 1 from public.workflow_registry w where w.organization_uuid=org_id and w.project_uuid=(result->>'project_id')::uuid and w.workflow_key=item.key)
    on conflict (organization_id,workflow_key) do nothing;
  select count(distinct workflow_key) into workflow_count from public.workflow_registry w where w.organization_uuid=org_id and w.project_uuid=(result->>'project_id')::uuid
    and workflow_key in (select jsonb_array_elements_text(workflows) from public.organization_templates where id=new_template_id);
  if workflow_count<>(select count(distinct value) from public.organization_templates t,lateral jsonb_array_elements_text(t.workflows) where t.id=new_template_id) then raise exception 'Photography workflow registry incomplete'; end if;
  select count(*) into new_workflows from public.workflow_registry where organization_uuid=org_id and not (prior_workflows ? id::text);
  update public.organization_template_assignments set metadata=metadata||jsonb_build_object('tenant_registry_completed',true,'workflows_created',new_workflows,'repair_key',repair_key),updated_at=now() where id=next_assignment.id and organization_id=org_id;
  update public.organization_template_assignments set status='paused',metadata=metadata||jsonb_build_object('superseded_by_assignment_id',next_assignment.id,'superseded_at',now(),'repair_key',repair_key,'reason','Incorrect Computer Service starter retired; Photography starter created as drafts'),updated_at=now() where id=old_assignment_id and organization_id=org_id;

  if prior_agents is distinct from (select coalesce(jsonb_object_agg(id::text,to_jsonb(a)),'{}') from public.agents a where organization_id=org_id and prior_agents ? id::text)
    or prior_integrations is distinct from (select coalesce(jsonb_object_agg(id::text,to_jsonb(i)),'{}') from public.organization_integrations i where organization_id=org_id and prior_integrations ? id::text)
    or prior_knowledge is distinct from (select coalesce(jsonb_object_agg(id::text,to_jsonb(k)),'{}') from public.knowledge_collections k where organization_id=org_id and prior_knowledge ? id::text)
    or prior_workflows is distinct from (select coalesce(jsonb_object_agg(id::text,to_jsonb(w)),'{}') from public.workflow_registry w where organization_uuid=org_id and prior_workflows ? id::text)
    then raise exception 'Existing tenant configuration changed; rolling back repair'; end if;
  if exists(select 1 from public.agents where organization_id=org_id and not(prior_agents ? id::text) and status<>'draft')
    or exists(select 1 from public.workflow_registry where organization_uuid=org_id and not(prior_workflows ? id::text) and status<>'draft')
    or exists(select 1 from public.organization_integrations where organization_id=org_id and not(prior_integrations ? id::text) and status<>'disconnected')
    then raise exception 'Starter unexpectedly activated'; end if;
  select jsonb_build_object('wallet',(select to_jsonb(w) from public.flux_credit_wallets w where organization_id=org_id),'subscriptions',(select jsonb_agg(to_jsonb(s) order by id) from public.organization_subscriptions s where organization_id=org_id)) into current_billing;
  if prior_billing is distinct from current_billing then raise exception 'Billing changed during starter repair'; end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,reason,metadata) values(org_id,'organization.industry_starter_repaired','organization_template_assignment',next_assignment.id::text,
    'Explicit user request: correct Xposure Photography starter, preserve existing published Maia and customer configuration',
    jsonb_build_object('actor_type','codex_operator','authorization','explicit user request','repair_key',repair_key,'outcome','success','previous_assignment_id',old_assignment_id,'replacement_assignment_id',next_assignment.id,'template_slug','photography-ai-suite','draft_agents_created',result->'agents_created','draft_workflows_created',new_workflows,'existing_configuration_preserved',true,'billing_unchanged',true,'external_deployment_attempted',false));
end $repair$;
