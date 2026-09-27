create or replace function public.ensure_organization_role_presets(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_manager uuid;
  v_supervisor uuid;
  v_member uuid;
begin
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found';
  end if;

  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_organization_id, 'Owner', 'owner', 'Full tenant ownership and administration.', true)
  on conflict (organization_id, slug) do update
    set name=excluded.name, description=excluded.description, is_system=true
  returning id into v_owner;

  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_organization_id, 'Manager', 'manager', 'Broad operational management without ownership transfer authority.', true)
  on conflict (organization_id, slug) do update
    set name=excluded.name, description=excluded.description, is_system=true
  returning id into v_manager;

  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_organization_id, 'Supervisor', 'supervisor', 'Operational monitoring and limited management access.', true)
  on conflict (organization_id, slug) do update
    set name=excluded.name, description=excluded.description, is_system=true
  returning id into v_supervisor;

  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_organization_id, 'Team Member', 'team-member', 'Standard organization worker access.', true)
  on conflict (organization_id, slug) do update
    set name=excluded.name, description=excluded.description, is_system=true
  returning id into v_member;

  insert into public.role_permissions (role_id, permission_id)
  select v_owner, p.id from public.permissions p
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_manager, p.id from public.permissions p
  where p.key = any(array[
    'organization.view','organization.read','organization.manage',
    'agents.view','agents.read','agents.manage',
    'systems.view','systems.manage',
    'integrations.view','integrations.manage',
    'knowledge.view','knowledge.manage',
    'customers.view','customers.manage',
    'conversations.view','conversations.reply',
    'appointments.view','appointments.manage',
    'analytics.view','audit.read',
    'workflows.read','workflows.manage','workflows.retry',
    'members.view','members.invite','members.suspend',
    'support.escalate','billing.view',
    'handoffs.view','handoffs.manage',
    'approvals.view','approvals.manage'
  ])
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_supervisor, p.id from public.permissions p
  where p.key = any(array[
    'organization.view','organization.read',
    'agents.view','agents.read',
    'systems.view','integrations.view','knowledge.view',
    'customers.view','conversations.view','conversations.reply',
    'appointments.view','appointments.manage',
    'analytics.view','audit.read','workflows.read',
    'members.view','support.escalate',
    'handoffs.view','handoffs.manage',
    'approvals.view'
  ])
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_member, p.id from public.permissions p
  where p.key = any(array[
    'organization.view','systems.view','customers.view',
    'conversations.view','conversations.reply',
    'appointments.view','support.escalate',
    'handoffs.view'
  ])
  on conflict do nothing;

  return jsonb_build_object(
    'owner_role_id',v_owner,'manager_role_id',v_manager,
    'supervisor_role_id',v_supervisor,'team_member_role_id',v_member
  );
end;
$$;

revoke all on function public.ensure_organization_role_presets(uuid) from public, anon, authenticated;
grant execute on function public.ensure_organization_role_presets(uuid) to service_role;
