-- Production-database rollback-only test. No external automation calls.
-- BLOCKED pending explicit approval for temporary schema and privilege changes.
-- Must be executed as ONE SQL request; never split at statement boundaries.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';
-- Reuse the existing atomic template provisioner. A request replay never creates a tenant twice.
-- No production migration is applied by this change.
create or replace function public.create_and_provision_organization(
  p_name text, p_template_slug text, p_industry text, p_business_email text,
  p_country text, p_timezone text, p_actor_user_id uuid, p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_metadata jsonb;
  v_fingerprint text := md5(jsonb_build_array(p_name, p_template_slug, p_industry, p_business_email, p_country, p_timezone)::text);
  v_industry text;
  v_repaired_workflows integer := 0;
  v_required_workflows integer := 0;
  v_tenant_workflows integer := 0;
begin
  if p_request_id is null then raise exception 'Creation request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('admin-create:' || p_request_id::text, 0));
  select metadata into v_metadata from public.organizations
    where metadata->>'creation_request_id' = p_request_id::text limit 1;
  if found then
    if v_metadata->>'creation_request_fingerprint' is distinct from v_fingerprint then
      raise exception 'Creation request parameters changed; use a new request ID';
    end if;
    return v_metadata->'creation_result';
  end if;
  select industry into v_industry from public.organization_templates where slug = p_template_slug and status = 'active';
  if not found then raise exception 'Active industry template is required'; end if;
  if nullif(trim(p_industry), '') is not null and lower(trim(p_industry)) <> lower(trim(v_industry)) then
    raise exception 'Industry must match the selected template';
  end if;
  v_result := public.create_and_provision_organization(p_name, p_template_slug, v_industry, p_business_email, p_country, p_timezone, p_actor_user_id);
  -- The legacy registry is unique on (organization_id text, workflow_key).
  -- The original RPC uses the shared template slug there, so subsequent tenants
  -- can silently lose all workflow rows to ON CONFLICT DO NOTHING. Complete only
  -- this new tenant's registry using its own UUID as the legacy namespace.
  insert into public.workflow_registry (
    organization_id, project_id, organization_uuid, branch_id, agent_family_id, project_uuid,
    workflow_key, name, description, provider, trigger_type, environment, status,
    current_version, timeout_seconds, max_retries, metadata
  )
  select
    v_result->>'organization_id', 'platform-starter', (v_result->>'organization_id')::uuid,
    (v_result->'provisioning'->>'branch_id')::uuid,
    (v_result->'provisioning'->>'agent_family_id')::uuid,
    (v_result->'provisioning'->>'project_id')::uuid,
    item.workflow_key, initcap(replace(item.workflow_key, '_', ' ')),
    'Draft workflow provisioned from the ' || template.name || ' template.',
    'n8n', 'webhook', 'production', 'draft', 1, 60, 2,
    jsonb_build_object('template_id', template.id, 'template_slug', template.slug)
  from public.organization_templates template
  cross join lateral (select distinct value as workflow_key from jsonb_array_elements_text(template.workflows)) item
  where template.slug = p_template_slug and template.status = 'active'
    and not exists (
      select 1 from public.workflow_registry existing
      where existing.organization_uuid = (v_result->>'organization_id')::uuid
        and existing.project_uuid = (v_result->'provisioning'->>'project_id')::uuid
        and existing.workflow_key = item.workflow_key
    )
  on conflict (organization_id, workflow_key) do nothing;
  get diagnostics v_repaired_workflows = row_count;
  select count(distinct value) into v_required_workflows
    from public.organization_templates template, lateral jsonb_array_elements_text(template.workflows)
    where template.slug = p_template_slug and template.status = 'active';
  select count(distinct workflow.workflow_key) into v_tenant_workflows
    from public.workflow_registry workflow
    where workflow.organization_uuid = (v_result->>'organization_id')::uuid
      and workflow.project_uuid = (v_result->'provisioning'->>'project_id')::uuid
      and workflow.workflow_key in (
        select jsonb_array_elements_text(template.workflows) from public.organization_templates template
        where template.slug = p_template_slug and template.status = 'active'
      );
  if v_tenant_workflows <> v_required_workflows then raise exception 'Tenant workflow registry is incomplete'; end if;
  if v_repaired_workflows > 0 then
    v_result := jsonb_set(v_result, '{provisioning,workflows_created}',
      to_jsonb(coalesce((v_result->'provisioning'->>'workflows_created')::integer, 0) + v_repaired_workflows));
    update public.organization_template_assignments set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'workflows_created', (v_result->'provisioning'->>'workflows_created')::integer,
      'tenant_registry_completed', true
    ) where id = (v_result->'provisioning'->>'assignment_id')::uuid
      and organization_id = (v_result->>'organization_id')::uuid;
  end if;
  update public.organizations set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'creation_request_id', p_request_id, 'creation_request_fingerprint', v_fingerprint, 'creation_result', v_result
  ) where id = (v_result->>'organization_id')::uuid;
  return v_result;
end;
$$;
revoke all on function public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid) to service_role;
do $test$
declare
  first_result jsonb;
  replay_result jsonb;
  org_id uuid;
  second_result jsonb;
  second_org_id uuid;
  rejected boolean := false;
begin
  first_result := public.create_and_provision_organization(
    'FLUXKNIGHT QA ROLLBACK 20261116', 'real-estate-ai-suite', 'Real Estate',
    'owner@fluxknight-test.invalid', 'Nigeria', 'Africa/Lagos', null,
    '75ffb45b-764e-4ea4-a9db-aa92286eed27'::uuid);
  replay_result := public.create_and_provision_organization(
    'FLUXKNIGHT QA ROLLBACK 20261116', 'real-estate-ai-suite', 'Real Estate',
    'owner@fluxknight-test.invalid', 'Nigeria', 'Africa/Lagos', null,
    '75ffb45b-764e-4ea4-a9db-aa92286eed27'::uuid);
  if first_result is distinct from replay_result then raise exception 'Replay returned different results'; end if;
  org_id := (first_result->>'organization_id')::uuid;
  if (select count(*) from public.organizations where metadata->>'creation_request_id'='75ffb45b-764e-4ea4-a9db-aa92286eed27') <> 1 then raise exception 'Duplicate request created duplicate tenants'; end if;
  if not exists(select 1 from public.projects where organization_id=org_id and slug='platform-starter') then raise exception 'Starter project missing'; end if;
  if not exists(select 1 from public.agents where organization_id=org_id) then raise exception 'Starter agents missing'; end if;
  if (select count(*) from public.workflow_registry where organization_uuid=org_id) <> (select count(distinct value) from public.organization_templates, lateral jsonb_array_elements_text(workflows) where slug='real-estate-ai-suite') then raise exception 'Starter workflow registry is incomplete for this tenant'; end if;
  if exists(select 1 from public.agents where organization_id=org_id and status <> 'draft') then raise exception 'Test agent is not draft'; end if;
  if exists(select 1 from public.organization_integrations where organization_id=org_id and status <> 'disconnected') then raise exception 'Test integration is not disconnected'; end if;
  if has_function_privilege('anon','public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid)','EXECUTE') then raise exception 'Unprivileged role can execute creation'; end if;
  second_result := public.create_and_provision_organization(
    'FLUXKNIGHT QA ROLLBACK SECOND 20261116', 'real-estate-ai-suite', 'Real Estate',
    'owner@fluxknight-test.invalid', 'Nigeria', 'Africa/Lagos', null,
    '85d9ad81-cf54-4d09-a9a1-0443dd9960e0'::uuid);
  second_org_id := (second_result->>'organization_id')::uuid;
  if second_org_id = org_id then raise exception 'Different tenants share an ID'; end if;
  if (select count(*) from public.workflow_registry where organization_uuid=second_org_id) <> (select count(distinct value) from public.organization_templates, lateral jsonb_array_elements_text(workflows) where slug='real-estate-ai-suite') then raise exception 'Second tenant workflow registry is incomplete'; end if;
  if exists(select 1 from public.workflow_registry where organization_uuid=second_org_id and status <> 'draft') then raise exception 'Second tenant workflow is not draft'; end if;
  begin
    perform public.create_and_provision_organization('Changed input', 'real-estate-ai-suite', 'Real Estate', 'owner@fluxknight-test.invalid', 'Nigeria', 'Africa/Lagos', null, '75ffb45b-764e-4ea4-a9db-aa92286eed27'::uuid);
  exception when others then
    if sqlerrm <> 'Creation request parameters changed; use a new request ID' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Conflicting replay was accepted'; end if;
end;
$test$;
rollback;
select jsonb_build_object(
  'test_organizations_remaining',(select count(*) from public.organizations where metadata->>'creation_request_id' in ('75ffb45b-764e-4ea4-a9db-aa92286eed27','85d9ad81-cf54-4d09-a9a1-0443dd9960e0')),
  'temporary_overload_remaining',to_regprocedure('public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid)') is not null
) as rollback_verification;
