create table if not exists public.platform_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_super_admins enable row level security;

create or replace function public.is_platform_super_admin()
returns boolean language sql stable security definer set search_path=public,auth
as $$ select exists(select 1 from public.platform_super_admins where user_id=auth.uid() and status='active') $$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path=public,auth
as $$ select public.is_platform_super_admin() or exists(select 1 from public.organization_memberships where organization_id=target_organization_id and user_id=auth.uid() and status='active') $$;

create or replace function public.has_organization_permission(target_organization_id uuid, permission_key text)
returns boolean language sql stable security definer set search_path=public,auth
as $$
select public.is_platform_super_admin() or exists(
  select 1 from public.organization_memberships om
  join public.membership_roles mr on mr.membership_id=om.id
  join public.role_permissions rp on rp.role_id=mr.role_id
  join public.permissions p on p.id=rp.permission_id
  where om.organization_id=target_organization_id and om.user_id=auth.uid() and om.status='active'
  and (p.key=permission_key or p.key=split_part(permission_key,'.',1)||'.*')
)
$$;

create or replace function public.resolve_organization_ai_model(target_organization_id uuid)
returns table(provider text,model_key text,display_name text,capabilities jsonb,settings jsonb)
language sql stable security definer set search_path=public
as $$
  select m.provider,m.model_key,m.display_name,m.capabilities,a.settings
  from public.organization_ai_model_assignments a
  join public.ai_model_catalog m on m.id=a.model_id
  where a.organization_id=target_organization_id and m.status='active'
  limit 1
$$;

revoke all on function public.is_platform_super_admin() from public,anon;
revoke all on function public.is_organization_member(uuid) from public,anon;
revoke all on function public.has_organization_permission(uuid,text) from public,anon;
revoke all on function public.resolve_organization_ai_model(uuid) from public,anon,authenticated;
grant execute on function public.is_platform_super_admin() to authenticated,service_role;
grant execute on function public.is_organization_member(uuid) to authenticated,service_role;
grant execute on function public.has_organization_permission(uuid,text) to authenticated,service_role;
grant execute on function public.resolve_organization_ai_model(uuid) to service_role;

alter table public.agents alter column ai_model drop default;
comment on column public.agents.ai_model is 'Deprecated compatibility field. Runtime model is resolved server-side from organization_ai_model_assignments.';

insert into public.permissions(key,description) values
('organization.view','View organization workspace'),('organization.manage','Manage organization settings'),
('agents.view','View agents'),('agents.manage','Create and update agents'),
('integrations.view','View integration status'),('integrations.manage','Manage integration credentials'),
('knowledge.view','View knowledge sources'),('knowledge.manage','Manage knowledge sources'),
('memory.view','View customer memory'),('memory.manage','Manage customer memory'),
('members.view','View organization members'),('members.manage','Manage organization members')
on conflict(key) do nothing;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.agents enable row level security;
alter table public.organization_integrations enable row level security;
alter table public.knowledge_collections enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.customer_memories enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations for select to authenticated using(public.is_organization_member(id));
drop policy if exists memberships_member_select on public.organization_memberships;
create policy memberships_member_select on public.organization_memberships for select to authenticated using(public.is_organization_member(organization_id));
drop policy if exists memberships_admin_manage on public.organization_memberships;
create policy memberships_admin_manage on public.organization_memberships for all to authenticated using(public.has_organization_permission(organization_id,'members.manage')) with check(public.has_organization_permission(organization_id,'members.manage'));
drop policy if exists agents_member_select on public.agents;
create policy agents_member_select on public.agents for select to authenticated using(public.has_organization_permission(organization_id,'agents.view') or public.has_organization_permission(organization_id,'agents.manage'));
drop policy if exists agents_member_manage on public.agents;
create policy agents_member_manage on public.agents for all to authenticated using(public.has_organization_permission(organization_id,'agents.manage')) with check(public.has_organization_permission(organization_id,'agents.manage'));
drop policy if exists integrations_member_select on public.organization_integrations;
create policy integrations_member_select on public.organization_integrations for select to authenticated using(public.has_organization_permission(organization_id,'integrations.view') or public.has_organization_permission(organization_id,'integrations.manage'));
drop policy if exists integrations_member_manage on public.organization_integrations;
create policy integrations_member_manage on public.organization_integrations for all to authenticated using(public.has_organization_permission(organization_id,'integrations.manage')) with check(public.has_organization_permission(organization_id,'integrations.manage'));
drop policy if exists knowledge_collections_member_select on public.knowledge_collections;
create policy knowledge_collections_member_select on public.knowledge_collections for select to authenticated using(public.has_organization_permission(organization_id,'knowledge.view') or public.has_organization_permission(organization_id,'knowledge.manage'));
drop policy if exists knowledge_collections_member_manage on public.knowledge_collections;
create policy knowledge_collections_member_manage on public.knowledge_collections for all to authenticated using(public.has_organization_permission(organization_id,'knowledge.manage')) with check(public.has_organization_permission(organization_id,'knowledge.manage'));
drop policy if exists knowledge_sources_member_select on public.knowledge_sources;
create policy knowledge_sources_member_select on public.knowledge_sources for select to authenticated using(public.has_organization_permission(organization_id,'knowledge.view') or public.has_organization_permission(organization_id,'knowledge.manage'));
drop policy if exists knowledge_sources_member_manage on public.knowledge_sources;
create policy knowledge_sources_member_manage on public.knowledge_sources for all to authenticated using(public.has_organization_permission(organization_id,'knowledge.manage')) with check(public.has_organization_permission(organization_id,'knowledge.manage'));
drop policy if exists customer_memories_member_select on public.customer_memories;
create policy customer_memories_member_select on public.customer_memories for select to authenticated using(public.has_organization_permission(organization_id,'memory.view') or public.has_organization_permission(organization_id,'memory.manage'));
drop policy if exists customer_memories_member_manage on public.customer_memories;
create policy customer_memories_member_manage on public.customer_memories for all to authenticated using(public.has_organization_permission(organization_id,'memory.manage')) with check(public.has_organization_permission(organization_id,'memory.manage'));
drop policy if exists audit_logs_member_select on public.audit_logs;
create policy audit_logs_member_select on public.audit_logs for select to authenticated using(organization_id is not null and public.is_organization_member(organization_id));