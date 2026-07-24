create or replace function public.slugify_identifier(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.provision_client_organization(
  p_user_id uuid,
  p_organization_name text,
  p_organization_slug text default null,
  p_template_slug text default null,
  p_agent_family_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_role_id uuid;
  v_membership_id uuid;
  v_template_id uuid;
  v_family_id uuid;
  v_project_id uuid;
  v_org_slug text;
  v_family_name text;
  v_family_slug text;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Supabase Auth user does not exist';
  end if;

  if nullif(trim(p_organization_name), '') is null then
    raise exception 'organization_name is required';
  end if;

  if exists (
    select 1
    from public.organization_memberships
    where user_id = p_user_id and status in ('active', 'invited')
  ) then
    raise exception 'User already has an active organization membership';
  end if;

  v_org_slug := public.slugify_identifier(coalesce(nullif(trim(p_organization_slug), ''), p_organization_name));
  if v_org_slug = '' then
    raise exception 'A valid organization slug could not be generated';
  end if;

  if exists (select 1 from public.organizations where slug = v_org_slug) then
    v_org_slug := v_org_slug || '-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6);
  end if;

  insert into public.organizations (name, slug, status)
  values (trim(p_organization_name), v_org_slug, 'active')
  returning id into v_org_id;

  insert into public.branches (organization_id, name, slug, status)
  values (v_org_id, 'Main Branch', 'main', 'active')
  returning id into v_branch_id;

  insert into public.roles (organization_id, name, slug, description, is_system)
  values (v_org_id, 'Owner', 'owner', 'Full organization owner access.', false)
  returning id into v_role_id;

  insert into public.organization_memberships (organization_id, branch_id, user_id, status)
  values (v_org_id, v_branch_id, p_user_id, 'active')
  returning id into v_membership_id;

  insert into public.membership_roles (membership_id, role_id)
  values (v_membership_id, v_role_id);

  insert into public.role_permissions (role_id, permission_id)
  select v_role_id, id from public.permissions
  on conflict do nothing;

  if nullif(trim(p_template_slug), '') is not null then
    select id into v_template_id
    from public.agent_templates
    where slug = trim(p_template_slug) and status = 'published'
    limit 1;

    if v_template_id is null then
      raise exception 'Published agent template not found: %', p_template_slug;
    end if;

    v_family_name := coalesce(nullif(trim(p_agent_family_name), ''), trim(p_organization_name));
    v_family_slug := public.slugify_identifier(v_family_name);

    insert into public.agent_families (
      organization_id,
      template_id,
      branch_id,
      name,
      slug,
      description,
      status
    )
    values (
      v_org_id,
      v_template_id,
      v_branch_id,
      v_family_name,
      v_family_slug,
      'Starter agent family provisioned during client onboarding.',
      'draft'
    )
    returning id into v_family_id;

    insert into public.projects (
      organization_id,
      agent_family_id,
      branch_id,
      name,
      slug,
      description,
      status
    )
    values (
      v_org_id,
      v_family_id,
      v_branch_id,
      'Starter Project',
      'starter',
      'Initial project created during client onboarding.',
      'draft'
    )
    returning id into v_project_id;
  end if;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    actor_user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_org_id,
    v_branch_id,
    p_user_id,
    'organization.provisioned',
    'organization',
    v_org_id::text,
    jsonb_build_object(
      'organization_slug', v_org_slug,
      'membership_id', v_membership_id,
      'agent_family_id', v_family_id,
      'project_id', v_project_id
    )
  );

  return jsonb_build_object(
    'organization_id', v_org_id,
    'organization_slug', v_org_slug,
    'branch_id', v_branch_id,
    'membership_id', v_membership_id,
    'role_id', v_role_id,
    'agent_family_id', v_family_id,
    'project_id', v_project_id
  );
end;
$$;

revoke all on function public.provision_client_organization(uuid, text, text, text, text) from public;
revoke all on function public.provision_client_organization(uuid, text, text, text, text) from anon;
revoke all on function public.provision_client_organization(uuid, text, text, text, text) from authenticated;
grant execute on function public.provision_client_organization(uuid, text, text, text, text) to service_role;

comment on function public.provision_client_organization(uuid, text, text, text, text)
is 'Atomically provisions an organization, main branch, owner membership, permissions, and optional starter agent family for an existing Supabase Auth user.';