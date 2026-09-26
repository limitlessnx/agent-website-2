
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role_id uuid not null references public.roles(id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_invitations_pending_email_idx
  on public.organization_invitations (organization_id, lower(email))
  where status = 'pending';

create index if not exists organization_invitations_org_status_idx
  on public.organization_invitations (organization_id, status, expires_at);

alter table public.organization_invitations enable row level security;
revoke all on table public.organization_invitations from public, anon, authenticated;
grant select, insert, update, delete on table public.organization_invitations to service_role;

insert into public.permissions (key, description)
values
  ('systems.view', 'View installed organization systems.'),
  ('systems.manage', 'Install, configure, pause, and manage organization systems.'),
  ('customers.view', 'View organization customers and leads.'),
  ('customers.manage', 'Create and manage organization customers and leads.'),
  ('conversations.view', 'View organization conversations.'),
  ('conversations.reply', 'Reply to organization conversations.'),
  ('appointments.view', 'View organization appointments.'),
  ('appointments.manage', 'Create, update, reschedule, and cancel organization appointments.'),
  ('analytics.view', 'View organization analytics.'),
  ('billing.view', 'View organization billing and plan information.'),
  ('billing.manage', 'Manage organization billing and plan settings.'),
  ('members.invite', 'Invite team members to the organization.'),
  ('members.roles.manage', 'Change team roles and role permission presets.'),
  ('members.suspend', 'Suspend, reactivate, or remove organization members.'),
  ('support.escalate', 'Escalate organization issues to Fluxknight support.'),
  ('organization.owner.transfer', 'Transfer organization ownership.')
on conflict (key) do update set description = excluded.description;

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
    'support.escalate','billing.view'
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
    'members.view','support.escalate'
  ])
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_member, p.id from public.permissions p
  where p.key = any(array[
    'organization.view','systems.view','customers.view',
    'conversations.view','conversations.reply',
    'appointments.view','support.escalate'
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

do $$
declare v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.ensure_organization_role_presets(v_org.id);
  end loop;
end
$$;

create or replace function public.organization_effective_seat_limit(p_organization_id uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select greatest(
    1,
    coalesce(
      (
        select floor(e.limit_value)::integer
        from public.organization_entitlements e
        where e.organization_id=p_organization_id
          and e.feature_key='team.seats'
          and e.enabled=true
          and (e.expires_at is null or e.expires_at > now())
        order by e.updated_at desc
        limit 1
      ),
      3
    )
  );
$$;

revoke all on function public.organization_effective_seat_limit(uuid) from public, anon, authenticated;
grant execute on function public.organization_effective_seat_limit(uuid) to service_role;

create or replace function public.create_organization_invitation(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_email text,
  p_role_slug text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_role public.roles%rowtype;
  v_limit integer;
  v_occupied integer;
  v_invitation_id uuid;
begin
  if v_email='' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email is required';
  end if;
  if length(coalesce(p_token_hash,'')) < 32 then raise exception 'Invalid invitation token hash'; end if;
  if p_expires_at <= now() then raise exception 'Invitation expiry must be in the future'; end if;

  if not exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id=m.id
    join public.role_permissions rp on rp.role_id=mr.role_id
    join public.permissions p on p.id=rp.permission_id
    where m.organization_id=p_organization_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and p.key in ('members.invite','members.manage')
  ) then raise exception 'Not authorized to invite organization members'; end if;

  select * into v_role
  from public.roles
  where organization_id=p_organization_id and slug=p_role_slug
  limit 1;

  if not found or v_role.slug='owner' then raise exception 'Invalid invitation role'; end if;

  if exists (
    select 1
    from public.organization_memberships m
    join auth.users u on u.id=m.user_id
    where m.organization_id=p_organization_id
      and lower(coalesce(u.email,''))=v_email
      and m.status in ('active','suspended','invited')
  ) then raise exception 'This person is already attached to the organization'; end if;

  update public.organization_invitations
  set status='expired',updated_at=now()
  where organization_id=p_organization_id and status='pending' and expires_at <= now();

  v_limit := public.organization_effective_seat_limit(p_organization_id);

  select
    (select count(*) from public.organization_memberships
      where organization_id=p_organization_id and status in ('active','suspended'))
    +
    (select count(*) from public.organization_invitations
      where organization_id=p_organization_id and status='pending' and expires_at > now())
  into v_occupied;

  if v_occupied >= v_limit then raise exception 'Organization team seat limit reached'; end if;

  if exists (
    select 1 from public.organization_invitations
    where organization_id=p_organization_id and lower(email)=v_email
      and status='pending' and expires_at > now()
  ) then raise exception 'A pending invitation already exists for this email'; end if;

  insert into public.organization_invitations(
    organization_id,email,role_id,token_hash,status,invited_by,expires_at
  ) values (
    p_organization_id,v_email,v_role.id,p_token_hash,'pending',p_actor_user_id,p_expires_at
  ) returning id into v_invitation_id;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    p_organization_id,p_actor_user_id,'organization.member_invited',
    'organization_invitation',v_invitation_id::text,
    jsonb_build_object('email',v_email,'role',v_role.slug,'expires_at',p_expires_at)
  );

  return jsonb_build_object(
    'ok',true,'invitation_id',v_invitation_id,'organization_id',p_organization_id,
    'email',v_email,'role',v_role.slug,'expires_at',p_expires_at,
    'seat_limit',v_limit,'occupied_seats',v_occupied+1
  );
end;
$$;

revoke all on function public.create_organization_invitation(uuid,uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_organization_invitation(uuid,uuid,text,text,text,timestamptz) to service_role;

create or replace function public.accept_organization_invitation(
  p_user_id uuid,
  p_user_email text,
  p_token_hash text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_user_email,'')));
  v_invitation public.organization_invitations%rowtype;
  v_membership_id uuid;
  v_role_slug text;
begin
  select i.* into v_invitation
  from public.organization_invitations i
  where i.token_hash=p_token_hash and i.status='pending'
  limit 1 for update;

  if not found then raise exception 'Invitation is invalid or no longer available'; end if;

  if v_invitation.expires_at <= now() then
    update public.organization_invitations set status='expired',updated_at=now() where id=v_invitation.id;
    raise exception 'Invitation has expired';
  end if;

  if lower(v_invitation.email) <> v_email then
    raise exception 'Invitation email does not match the authenticated account';
  end if;

  if not exists (
    select 1 from auth.users where id=p_user_id and lower(coalesce(email,''))=v_email
  ) then raise exception 'Authenticated user identity could not be verified'; end if;

  insert into public.organization_memberships(organization_id,user_id,status)
  values(v_invitation.organization_id,p_user_id,'active')
  on conflict (organization_id,user_id) do update set status='active',updated_at=now()
  returning id into v_membership_id;

  delete from public.membership_roles where membership_id=v_membership_id;
  insert into public.membership_roles(membership_id,role_id)
  values(v_membership_id,v_invitation.role_id);

  select slug into v_role_slug from public.roles where id=v_invitation.role_id;

  update public.organization_invitations
  set status='accepted',accepted_by=p_user_id,accepted_at=now(),updated_at=now()
  where id=v_invitation.id;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    v_invitation.organization_id,p_user_id,'organization.member_joined',
    'organization_membership',v_membership_id::text,
    jsonb_build_object('invitation_id',v_invitation.id,'role',v_role_slug)
  );

  return jsonb_build_object(
    'ok',true,'organization_id',v_invitation.organization_id,
    'membership_id',v_membership_id,'role',v_role_slug
  );
end;
$$;

revoke all on function public.accept_organization_invitation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.accept_organization_invitation(uuid,text,text) to service_role;

create or replace function public.update_organization_member_access(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_membership_id uuid,
  p_role_slug text default null,
  p_status text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_target public.organization_memberships%rowtype;
  v_current_role text;
  v_new_role_id uuid;
  v_effective_status text;
begin
  if not exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id=m.id
    join public.role_permissions rp on rp.role_id=mr.role_id
    join public.permissions p on p.id=rp.permission_id
    where m.organization_id=p_organization_id and m.user_id=p_actor_user_id
      and m.status='active'
      and p.key in ('members.roles.manage','members.suspend','members.manage')
  ) then raise exception 'Not authorized to manage organization members'; end if;

  select * into v_target
  from public.organization_memberships
  where id=p_membership_id and organization_id=p_organization_id
  limit 1 for update;

  if not found then raise exception 'Organization member not found'; end if;

  select r.slug into v_current_role
  from public.membership_roles mr
  join public.roles r on r.id=mr.role_id
  where mr.membership_id=v_target.id
  order by case when r.slug='owner' then 0 else 1 end,mr.created_at
  limit 1;

  if v_current_role='owner' then
    if p_role_slug is not null and p_role_slug <> 'owner' then
      raise exception 'Owner role changes require the ownership transfer flow';
    end if;
    if p_status is not null and p_status <> 'active' then
      raise exception 'Owner cannot be suspended or removed through member management';
    end if;
  end if;

  if p_actor_user_id=v_target.user_id and p_status is not null and p_status <> 'active' then
    raise exception 'You cannot suspend or remove your own membership';
  end if;

  if p_role_slug is not null then
    if p_role_slug='owner' then raise exception 'Owner role can only be assigned through ownership transfer'; end if;
    select id into v_new_role_id from public.roles
    where organization_id=p_organization_id and slug=p_role_slug limit 1;
    if v_new_role_id is null then raise exception 'Invalid organization role'; end if;
    delete from public.membership_roles where membership_id=v_target.id;
    insert into public.membership_roles(membership_id,role_id) values(v_target.id,v_new_role_id);
  end if;

  if p_status is not null then
    if p_status not in ('active','suspended','removed') then raise exception 'Invalid membership status'; end if;
    update public.organization_memberships set status=p_status,updated_at=now() where id=v_target.id;
  end if;

  select status into v_effective_status from public.organization_memberships where id=v_target.id;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    p_organization_id,p_actor_user_id,'organization.member_access_updated',
    'organization_membership',v_target.id::text,
    jsonb_build_object(
      'previous_role',v_current_role,'requested_role',p_role_slug,
      'requested_status',p_status,'effective_status',v_effective_status
    )
  );

  return jsonb_build_object(
    'ok',true,'membership_id',v_target.id,'status',v_effective_status,
    'role',coalesce(p_role_slug,v_current_role)
  );
end;
$$;

revoke all on function public.update_organization_member_access(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.update_organization_member_access(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.set_organization_role_permissions(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_role_slug text,
  p_permission_keys text[]
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_role_id uuid;
  v_unknown text[];
begin
  if not exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id=m.id
    join public.role_permissions rp on rp.role_id=mr.role_id
    join public.permissions p on p.id=rp.permission_id
    where m.organization_id=p_organization_id and m.user_id=p_actor_user_id
      and m.status='active' and p.key in ('members.roles.manage','members.manage')
  ) then raise exception 'Not authorized to change role permissions'; end if;

  if p_role_slug not in ('manager','supervisor','team-member') then
    raise exception 'Only Manager, Supervisor, and Team Member presets can be customized';
  end if;

  select id into v_role_id from public.roles
  where organization_id=p_organization_id and slug=p_role_slug limit 1;
  if v_role_id is null then raise exception 'Organization role not found'; end if;

  select array_agg(k) into v_unknown
  from unnest(coalesce(p_permission_keys,array[]::text[])) k
  where not exists (select 1 from public.permissions p where p.key=k);

  if coalesce(array_length(v_unknown,1),0) > 0 then
    raise exception 'Unknown permission key(s): %',array_to_string(v_unknown,', ');
  end if;

  delete from public.role_permissions where role_id=v_role_id;
  insert into public.role_permissions(role_id,permission_id)
  select v_role_id,p.id from public.permissions p
  where p.key=any(coalesce(p_permission_keys,array[]::text[]))
  on conflict do nothing;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    p_organization_id,p_actor_user_id,'organization.role_permissions_updated',
    'role',v_role_id::text,
    jsonb_build_object('role',p_role_slug,'permissions',coalesce(to_jsonb(p_permission_keys),'[]'::jsonb))
  );

  return jsonb_build_object(
    'ok',true,'role',p_role_slug,
    'permissions',coalesce(to_jsonb(p_permission_keys),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.set_organization_role_permissions(uuid,uuid,text,text[]) from public, anon, authenticated;
grant execute on function public.set_organization_role_permissions(uuid,uuid,text,text[]) to service_role;

create or replace function public.revoke_organization_invitation(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_invitation_id uuid
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id=m.id
    join public.role_permissions rp on rp.role_id=mr.role_id
    join public.permissions p on p.id=rp.permission_id
    where m.organization_id=p_organization_id and m.user_id=p_actor_user_id
      and m.status='active' and p.key in ('members.invite','members.manage')
  ) then raise exception 'Not authorized to revoke invitations'; end if;

  update public.organization_invitations
  set status='revoked',revoked_at=now(),updated_at=now()
  where id=p_invitation_id and organization_id=p_organization_id and status='pending';

  if not found then raise exception 'Pending invitation not found'; end if;

  insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id)
  values(
    p_organization_id,p_actor_user_id,'organization.invitation_revoked',
    'organization_invitation',p_invitation_id::text
  );

  return true;
end;
$$;

revoke all on function public.revoke_organization_invitation(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.revoke_organization_invitation(uuid,uuid,uuid) to service_role;

drop policy if exists memberships_team_view on public.organization_memberships;
create policy memberships_team_view
on public.organization_memberships for select to authenticated
using (
  user_id=(select auth.uid())
  or public.has_organization_permission(organization_id,'members.view')
  or public.has_organization_permission(organization_id,'members.manage')
);

drop policy if exists membership_roles_team_view on public.membership_roles;
create policy membership_roles_team_view
on public.membership_roles for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships target_membership
    where target_membership.id=membership_id
      and (
        target_membership.user_id=(select auth.uid())
        or public.has_organization_permission(target_membership.organization_id,'members.view')
        or public.has_organization_permission(target_membership.organization_id,'members.manage')
      )
  )
);

drop policy if exists role_permissions_team_view on public.role_permissions;
create policy role_permissions_team_view
on public.role_permissions for select to authenticated
using (
  exists (
    select 1 from public.roles r
    where r.id=role_id and r.organization_id is not null
      and public.is_organization_member(r.organization_id)
  )
);

drop policy if exists permissions_authenticated_select on public.permissions;
create policy permissions_authenticated_select
on public.permissions for select to authenticated
using (true);

comment on table public.organization_invitations
is 'Tenant-scoped team invitations. Raw invitation tokens are never stored; only token hashes are persisted.';
comment on function public.create_organization_invitation(uuid,uuid,text,text,text,timestamptz)
is 'Service-role-only invitation creation with membership authorization and seat-limit enforcement.';
comment on function public.accept_organization_invitation(uuid,text,text)
is 'Service-role-only invitation acceptance. Verifies the authenticated account identity against the invited email.';
comment on function public.update_organization_member_access(uuid,uuid,uuid,text,text)
is 'Service-role-only member lifecycle and role update operation with tenant authorization checks.';
comment on function public.set_organization_role_permissions(uuid,uuid,text,text[])
is 'Service-role-only owner/authorized customization of Manager, Supervisor, and Team Member permission presets.';
