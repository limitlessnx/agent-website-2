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
