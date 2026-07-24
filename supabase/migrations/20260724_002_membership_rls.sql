create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create or replace function public.has_organization_permission(
  target_organization_id uuid,
  permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.membership_roles membership_role
      on membership_role.membership_id = membership.id
    join public.role_permissions role_permission
      on role_permission.role_id = membership_role.role_id
    join public.permissions permission
      on permission.id = role_permission.permission_id
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and permission.key = permission_key
  );
$$;

grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_permission(uuid, text) to authenticated;

insert into public.permissions (key, description)
values
  ('organization.read', 'View organization settings and tenant-owned records.'),
  ('agents.read', 'View agent families, projects, and agents.'),
  ('agents.manage', 'Create and modify agent families, projects, and agents.'),
  ('workflows.read', 'View workflow registry records and execution history.'),
  ('workflows.manage', 'Register, edit, activate, pause, and disable workflows.'),
  ('workflows.retry', 'Retry failed workflow executions.'),
  ('audit.read', 'View organization audit history.'),
  ('members.manage', 'Invite, suspend, and assign roles to organization members.')
on conflict (key) do update set description = excluded.description;

insert into public.roles (organization_id, name, slug, description, is_system)
select organization.id, 'Owner', 'owner', 'Full organization administration access.', true
from public.organizations organization
where organization.slug = 'fluxknight'
on conflict (organization_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.organizations organization on organization.id = role.organization_id
cross join public.permissions permission
where organization.slug = 'fluxknight'
  and role.slug = 'owner'
on conflict do nothing;

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select
on public.organizations
for select
to authenticated
using (public.is_organization_member(id));

drop policy if exists branches_member_select on public.branches;
create policy branches_member_select
on public.branches
for select
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists roles_member_select on public.roles;
create policy roles_member_select
on public.roles
for select
to authenticated
using (organization_id is null or public.is_organization_member(organization_id));

drop policy if exists memberships_self_select on public.organization_memberships;
create policy memberships_self_select
on public.organization_memberships
for select
to authenticated
using (user_id = auth.uid() or public.has_organization_permission(organization_id, 'members.manage'));

drop policy if exists agent_families_member_select on public.agent_families;
create policy agent_families_member_select
on public.agent_families
for select
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists projects_member_select on public.projects;
create policy projects_member_select
on public.projects
for select
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists agents_member_select on public.agents;
create policy agents_member_select
on public.agents
for select
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists audit_logs_member_select on public.audit_logs;
create policy audit_logs_member_select
on public.audit_logs
for select
to authenticated
using (public.has_organization_permission(organization_id, 'audit.read'));

drop policy if exists workflow_registry_member_select on public.workflow_registry;
create policy workflow_registry_member_select
on public.workflow_registry
for select
to authenticated
using (
  organization_uuid is not null
  and public.is_organization_member(organization_uuid)
);

drop policy if exists workflow_runs_member_select on public.workflow_runs;
create policy workflow_runs_member_select
on public.workflow_runs
for select
to authenticated
using (
  organization_uuid is not null
  and public.is_organization_member(organization_uuid)
);

comment on function public.is_organization_member(uuid)
is 'Returns true when the authenticated user has an active membership in the target organization.';

comment on function public.has_organization_permission(uuid, text)
is 'Returns true when the authenticated user receives a permission through an active organization membership role.';
