-- Owner-only tenant member administration and atomic seat enforcement.
-- NOT applied to production automatically. Generated from inspected live SQL definitions.

-- approve_organization_access_request
CREATE OR REPLACE FUNCTION public.approve_organization_access_request(p_request_id uuid, p_actor_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request public.organization_access_requests%rowtype;
  v_role_id uuid;
  v_membership_id uuid;
begin
  select organization_id into v_request.organization_id from public.organization_access_requests where id=p_request_id;
  perform pg_advisory_xact_lock(hashtextextended(v_request.organization_id::text, 187));
  -- Service-role endpoint: caller identity is validated by tenant owner membership below.
  select * into v_request
  from public.organization_access_requests
  where id = p_request_id and status = 'pending'
  for update;

  if v_request.id is null then
    raise exception 'Access request is no longer pending.';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.roles r on r.id = mr.role_id
    where m.organization_id = v_request.organization_id
      and m.user_id = p_actor_user_id
      and m.status = 'active'
      and r.organization_id = m.organization_id
      and r.slug = 'owner'
  ) then
    raise exception 'Organization admin access required.';
  end if;

  select id into v_role_id
  from public.roles
  where organization_id = v_request.organization_id
    and slug = 'manager'
  limit 1;

  -- Never substitute owner access if the manager preset is missing.
  if v_role_id is null then
    raise exception 'Manager role is not configured for this organization.';
  end if;

  if not exists (select 1 from public.organizations where id=v_request.organization_id and status='active') then
    raise exception 'Organization is inactive';
  end if;

  -- An email invitation and Access ID approval reserve only one seat for this account.
  update public.organization_invitations i set status='revoked',revoked_at=now(),updated_at=now()
  where i.organization_id=v_request.organization_id and i.status='pending'
    and lower(i.email)=(select lower(email) from auth.users where id=v_request.requester_user_id);
  if not exists (
    select 1 from public.organization_memberships
    where organization_id = v_request.organization_id
      and user_id = v_request.requester_user_id
      and status in ('active','suspended')
  ) and (
    (select count(*) from public.organization_memberships
      where organization_id = v_request.organization_id and status in ('active','suspended'))
    + (select count(*) from public.organization_invitations
      where organization_id = v_request.organization_id and status = 'pending' and expires_at > now())
  ) >= public.organization_effective_seat_limit(v_request.organization_id) then
    raise exception 'Organization team seat limit reached';
  end if;

  -- A previously removed owner must never regain ownership via manager approval.
  if exists (
    select 1 from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.roles r on r.id = mr.role_id
    where m.organization_id = v_request.organization_id
      and m.user_id = v_request.requester_user_id
      and r.organization_id = m.organization_id
      and r.slug = 'owner'
  ) then
    raise exception 'Owner access cannot be changed through manager approval';
  end if;

  -- A stale request must not overwrite an already active membership's roles.
  select id into v_membership_id from public.organization_memberships
  where organization_id=v_request.organization_id and user_id=v_request.requester_user_id and status='active';
  if v_membership_id is null then
  insert into public.organization_memberships(organization_id, user_id, status)
  values (v_request.organization_id, v_request.requester_user_id, 'active')
  on conflict do nothing
  returning id into v_membership_id;

  if v_membership_id is null then
    select id into v_membership_id
    from public.organization_memberships
    where organization_id = v_request.organization_id
      and user_id = v_request.requester_user_id
    limit 1;
    update public.organization_memberships set status = 'active', updated_at = now()
    where id = v_membership_id;
  end if;

  -- Existing removed memberships can carry stale roles: replace with Manager.
  delete from public.membership_roles where membership_id = v_membership_id;
  insert into public.membership_roles(membership_id, role_id)
  values (v_membership_id, v_role_id)
  on conflict do nothing;

  end if;

  update public.organization_access_requests
  set status = 'approved', reviewed_by = p_actor_user_id, reviewed_at = now(), updated_at = now()
  where id = v_request.id;

  insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(v_request.organization_id,p_actor_user_id,'organization.access_request_approved','organization_access_request',v_request.id::text,
    jsonb_build_object('membership_id',v_membership_id,'requester_user_id',v_request.requester_user_id));

  return jsonb_build_object('organization_id', v_request.organization_id, 'membership_id', v_membership_id, 'status', 'approved');
end;
$function$
;

-- create_organization_invitation
CREATE OR REPLACE FUNCTION public.create_organization_invitation(p_organization_id uuid, p_actor_user_id uuid, p_email text, p_role_slug text, p_token_hash text, p_expires_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_role public.roles%rowtype;
  v_limit integer;
  v_occupied integer;
  v_invitation_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 187));
  if not exists(select 1 from public.organizations where id=p_organization_id and status='active') then raise exception 'Organization is inactive'; end if;
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email is required';
  end if;
  if length(coalesce(p_token_hash,'')) < 32 then
    raise exception 'Invalid invitation token hash';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.roles r on r.id = mr.role_id
    where m.organization_id = p_organization_id
      and m.user_id = p_actor_user_id
      and m.status = 'active'
      and r.organization_id = m.organization_id
      and r.slug = 'owner'
  ) then
    raise exception 'Not authorized to invite organization members';
  end if;

  select * into v_role
  from public.roles
  where organization_id = p_organization_id
    and slug = p_role_slug
  limit 1;

  if not found or v_role.slug not in ('manager','supervisor','team-member') then
    raise exception 'Invalid invitation role';
  end if;

  if exists (
    select 1
    from public.organization_memberships m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id
      and lower(coalesce(u.email,'')) = v_email
      and m.status in ('active','suspended','invited')
  ) then
    raise exception 'This person is already attached to the organization';
  end if;

  update public.organization_invitations
  set status = 'expired', updated_at = now()
  where organization_id = p_organization_id
    and status = 'pending'
    and expires_at <= now();

  v_limit := public.organization_effective_seat_limit(p_organization_id);

  select
    (select count(*) from public.organization_memberships
      where organization_id = p_organization_id and status in ('active','suspended'))
    +
    (select count(*) from public.organization_invitations
      where organization_id = p_organization_id and status = 'pending' and expires_at > now())
  into v_occupied;

  if v_occupied >= v_limit then
    raise exception 'Organization team seat limit reached';
  end if;

  if exists (
    select 1 from public.organization_invitations
    where organization_id = p_organization_id
      and lower(email) = v_email
      and status = 'pending'
      and expires_at > now()
  ) then
    raise exception 'A pending invitation already exists for this email';
  end if;

  insert into public.organization_invitations (
    organization_id,email,role_id,token_hash,status,invited_by,expires_at
  ) values (
    p_organization_id,v_email,v_role.id,p_token_hash,'pending',p_actor_user_id,p_expires_at
  )
  returning id into v_invitation_id;

  insert into public.audit_logs (
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    p_organization_id,p_actor_user_id,'organization.member_invited',
    'organization_invitation',v_invitation_id::text,
    jsonb_build_object('email',v_email,'role',v_role.slug,'expires_at',p_expires_at)
  );

  return jsonb_build_object(
    'ok',true,
    'invitation_id',v_invitation_id,
    'organization_id',p_organization_id,
    'email',v_email,
    'role',v_role.slug,
    'expires_at',p_expires_at,
    'seat_limit',v_limit,
    'occupied_seats',v_occupied + 1
  );
end;
$function$
;

-- ensure_organization_role_presets
CREATE OR REPLACE FUNCTION public.ensure_organization_role_presets(p_organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'members.view',
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
$function$
;

-- set_organization_role_permissions
CREATE OR REPLACE FUNCTION public.set_organization_role_permissions(p_organization_id uuid, p_actor_user_id uuid, p_role_slug text, p_permission_keys text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role_id uuid;
  v_unknown text[];
begin
  if not exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id=m.id
    join public.roles r on r.id=mr.role_id
    where m.organization_id=p_organization_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and r.organization_id=m.organization_id
      and r.slug='owner'
  ) then
    raise exception 'Not authorized to change role permissions';
  end if;

  if p_role_slug not in ('manager','supervisor','team-member') then
    raise exception 'Only Manager, Supervisor, and Team Member presets can be customized';
  end if;

  select id into v_role_id
  from public.roles
  where organization_id=p_organization_id and slug=p_role_slug
  limit 1;

  if v_role_id is null then raise exception 'Organization role not found'; end if;

  select array_agg(k) into v_unknown
  from unnest(coalesce(p_permission_keys,array[]::text[])) k
  where not exists (select 1 from public.permissions p where p.key=k);

  if coalesce(array_length(v_unknown,1),0) > 0 then
    raise exception 'Unknown permission key(s): %', array_to_string(v_unknown,', ');
  end if;

  if exists (
    select 1 from unnest(coalesce(p_permission_keys,array[]::text[])) k
    where (k like 'members.%' and k <> 'members.view')
       or k = 'organization.owner.transfer' or (k like 'billing.%' and k <> 'billing.view')
  ) then
    raise exception 'Team access, ownership and billing permissions are reserved to the organization owner';
  end if;

  delete from public.role_permissions where role_id=v_role_id;

  insert into public.role_permissions(role_id,permission_id)
  select v_role_id,p.id
  from public.permissions p
  where p.key=any(coalesce(p_permission_keys,array[]::text[]))
  on conflict do nothing;

  insert into public.audit_logs (
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    p_organization_id,p_actor_user_id,'organization.role_permissions_updated',
    'role',v_role_id::text,
    jsonb_build_object('role',p_role_slug,'permissions',coalesce(to_jsonb(p_permission_keys),'[]'::jsonb))
  );

  return jsonb_build_object('ok',true,'role',p_role_slug,'permissions',coalesce(to_jsonb(p_permission_keys),'[]'::jsonb));
end;
$function$
;

-- update_organization_member_access
CREATE OR REPLACE FUNCTION public.update_organization_member_access(p_organization_id uuid, p_actor_user_id uuid, p_membership_id uuid, p_role_slug text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_target public.organization_memberships%rowtype;
  v_current_role text;
  v_new_role_id uuid;
  v_effective_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 187));
  if not exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id=m.id
    join public.roles r on r.id=mr.role_id
    where m.organization_id=p_organization_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and r.organization_id=m.organization_id
      and r.slug='owner'
  ) then
    raise exception 'Not authorized to manage organization members';
  end if;

  select * into v_target
  from public.organization_memberships
  where id=p_membership_id and organization_id=p_organization_id
  limit 1
  for update;

  if not found then raise exception 'Organization member not found'; end if;

  select r.slug into v_current_role
  from public.membership_roles mr
  join public.roles r on r.id=mr.role_id
  where mr.membership_id=v_target.id
  order by case when r.slug='owner' then 0 else 1 end, mr.created_at
  limit 1;

  if v_current_role='owner' then
    if v_target.status <> 'active' and p_status in ('active','suspended') then
      raise exception 'Owner reactivation requires the ownership transfer flow';
    end if;
    if p_role_slug is distinct from null and p_role_slug <> 'owner' then
      raise exception 'Owner role changes require the ownership transfer flow';
    end if;
    if p_status is not null and p_status <> 'active' then
      raise exception 'Owner cannot be suspended or removed through member management';
    end if;
  end if;

  if p_actor_user_id = v_target.user_id and p_status is not null and p_status <> 'active' then
    raise exception 'You cannot suspend or remove your own membership';
  end if;

  if p_status in ('active','suspended') and v_target.status not in ('active','suspended') then
    if not exists(select 1 from public.organizations where id=p_organization_id and status='active') then raise exception 'Organization is inactive'; end if;
    if (select count(*) from public.organization_memberships where organization_id=p_organization_id and status in ('active','suspended'))
       + (select count(*) from public.organization_invitations where organization_id=p_organization_id and status='pending' and expires_at>now())
       >= public.organization_effective_seat_limit(p_organization_id) then
      raise exception 'Organization team seat limit reached';
    end if;
  end if;

  if p_role_slug is not null then
    if p_role_slug not in ('manager','supervisor','team-member') then
      raise exception 'Owner role can only be assigned through ownership transfer';
    end if;

    select id into v_new_role_id
    from public.roles
    where organization_id=p_organization_id and slug=p_role_slug
    limit 1;

    if v_new_role_id is null then raise exception 'Invalid organization role'; end if;

    delete from public.membership_roles where membership_id=v_target.id;
    insert into public.membership_roles(membership_id,role_id)
    values(v_target.id,v_new_role_id);
  end if;

  if p_status is not null then
    if p_status not in ('active','suspended','removed') then
      raise exception 'Invalid membership status';
    end if;
    update public.organization_memberships
    set status=p_status,updated_at=now()
    where id=v_target.id;
  end if;

  select status into v_effective_status from public.organization_memberships where id=v_target.id;

  insert into public.audit_logs (
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    p_organization_id,p_actor_user_id,'organization.member_access_updated',
    'organization_membership',v_target.id::text,
    jsonb_build_object(
      'previous_role',v_current_role,
      'requested_role',p_role_slug,
      'requested_status',p_status,
      'effective_status',v_effective_status
    )
  );

  return jsonb_build_object(
    'ok',true,'membership_id',v_target.id,'status',v_effective_status,
    'role',coalesce(p_role_slug,v_current_role)
  );
end;
$function$
;

-- Remove legacy membership-control powers from existing manager role presets.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.organization_id is not null
  and r.slug <> 'owner'
  and ((p.key like 'members.%' and p.key <> 'members.view')
       or p.key = 'organization.owner.transfer'
       or (p.key like 'billing.%' and p.key <> 'billing.view'));

-- The legacy Access ID approval/rejection functions must be service-role only.
-- The public callable versions required auth.uid(), which conflicts with server-side service-role routing.
CREATE OR REPLACE FUNCTION public.reject_organization_access_request(p_request_id uuid, p_actor_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.organization_access_requests where id=p_request_id;
  perform pg_advisory_xact_lock(hashtextextended(v_org_id::text, 187));
  -- Server-validated owner action; no reliance on auth.uid() for service-role calls.
  if not exists (
    select 1
    from public.organization_access_requests ar
    join public.organization_memberships m on m.organization_id = ar.organization_id
    join public.membership_roles mr on mr.membership_id = m.id
    join public.roles r on r.id = mr.role_id
    where ar.id = p_request_id
      and ar.status = 'pending'
      and m.user_id = p_actor_user_id
      and m.status = 'active'
      and r.organization_id = m.organization_id
      and r.slug = 'owner'
  ) then
    raise exception 'Organization admin access required.';
  end if;

  update public.organization_access_requests
  set status = 'rejected', reviewed_by = p_actor_user_id, reviewed_at = now(), updated_at = now()
  where id = p_request_id and status = 'pending';

  if not found then raise exception 'Access request is no longer pending'; end if;
  insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id)
  values(v_org_id,p_actor_user_id,'organization.access_request_rejected','organization_access_request',p_request_id::text);
  return true;
end;
$function$
;

revoke all on function public.approve_organization_access_request(uuid,uuid) from public, anon, authenticated;
grant execute on function public.approve_organization_access_request(uuid,uuid) to service_role;
revoke all on function public.reject_organization_access_request(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reject_organization_access_request(uuid,uuid) to service_role;

-- Existing invitation reservation is converted atomically into a membership.
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(p_user_id uuid, p_user_email text, p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email text := lower(btrim(coalesce(p_user_email,'')));
  v_invitation public.organization_invitations%rowtype;
  v_membership_id uuid;
  v_role_slug text;
  v_occupied integer;
  v_existing_status text;
begin
  select i.* into v_invitation from public.organization_invitations i where i.token_hash=p_token_hash;
  perform pg_advisory_xact_lock(hashtextextended(v_invitation.organization_id::text, 187));
  select i.* into v_invitation
  from public.organization_invitations i
  where i.token_hash = p_token_hash
    and i.status = 'pending'
  limit 1
  for update;

  if not found then
    raise exception 'Invitation is invalid or no longer available';
  end if;

  if v_invitation.expires_at <= now() then
    update public.organization_invitations
    set status='expired', updated_at=now()
    where id=v_invitation.id;
    raise exception 'Invitation has expired';
  end if;

  if lower(v_invitation.email) <> v_email then
    raise exception 'Invitation email does not match the authenticated account';
  end if;

  if not exists (
    select 1 from auth.users
    where id = p_user_id and lower(coalesce(email,'')) = v_email
  ) then
    raise exception 'Authenticated user identity could not be verified';
  end if;

  if not exists(select 1 from public.organizations where id=v_invitation.organization_id and status='active') then raise exception 'Organization is inactive'; end if;
  if not exists(select 1 from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id=m.id join public.roles r on r.id=mr.role_id
    where m.organization_id=v_invitation.organization_id and m.user_id=v_invitation.invited_by and m.status='active'
      and r.organization_id=m.organization_id and r.slug='owner') then raise exception 'Invitation owner is no longer authorized'; end if;
  select slug into v_role_slug from public.roles where id=v_invitation.role_id and organization_id=v_invitation.organization_id;
  if v_role_slug is null or v_role_slug not in ('manager','supervisor','team-member') then raise exception 'Invalid invitation role'; end if;
  if exists(select 1 from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id=m.id join public.roles r on r.id=mr.role_id
    where m.organization_id=v_invitation.organization_id and m.user_id=p_user_id and r.slug='owner') then
    raise exception 'Owner access cannot be changed through invitation acceptance'; end if;
  select status into v_existing_status from public.organization_memberships where organization_id=v_invitation.organization_id and user_id=p_user_id;
  if v_existing_status='active' then raise exception 'You already have access to this organization'; end if;
  select (select count(*) from public.organization_memberships where organization_id=v_invitation.organization_id and status in ('active','suspended'))
    + (select count(*) from public.organization_invitations where organization_id=v_invitation.organization_id and status='pending' and expires_at>now() and id<>v_invitation.id)
    + case when v_existing_status='suspended' then 0 else 1 end into v_occupied;
  if v_occupied > public.organization_effective_seat_limit(v_invitation.organization_id) then raise exception 'Organization team seat limit reached'; end if;

  insert into public.organization_memberships (
    organization_id,user_id,status
  ) values (
    v_invitation.organization_id,p_user_id,'active'
  )
  on conflict (organization_id,user_id) do update
    set status='active', updated_at=now()
  returning id into v_membership_id;

  delete from public.membership_roles where membership_id = v_membership_id;
  insert into public.membership_roles (membership_id,role_id)
  values (v_membership_id,v_invitation.role_id);

  select slug into v_role_slug from public.roles where id=v_invitation.role_id;

  update public.organization_invitations
  set status='accepted',accepted_by=p_user_id,accepted_at=now(),updated_at=now()
  where id=v_invitation.id;

  insert into public.audit_logs (
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    v_invitation.organization_id,p_user_id,'organization.member_joined',
    'organization_membership',v_membership_id::text,
    jsonb_build_object('invitation_id',v_invitation.id,'role',v_role_slug)
  );

  return jsonb_build_object(
    'ok',true,
    'organization_id',v_invitation.organization_id,
    'membership_id',v_membership_id,
    'role',v_role_slug
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.revoke_organization_invitation(p_organization_id uuid, p_actor_user_id uuid, p_invitation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 187));
  if not exists (
    select 1
    from public.organization_memberships m
    join public.membership_roles mr on mr.membership_id=m.id
    join public.roles r on r.id=mr.role_id
    where m.organization_id=p_organization_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and r.organization_id=m.organization_id and r.slug='owner'
  ) then
    raise exception 'Not authorized to revoke invitations';
  end if;

  update public.organization_invitations
  set status='revoked',revoked_at=now(),updated_at=now()
  where id=p_invitation_id
    and organization_id=p_organization_id
    and status='pending';

  if not found then raise exception 'Pending invitation not found'; end if;

  insert into public.audit_logs (
    organization_id,actor_user_id,action,resource_type,resource_id
  ) values (
    p_organization_id,p_actor_user_id,'organization.invitation_revoked',
    'organization_invitation',p_invitation_id::text
  );

  return true;
end;
$function$
;

-- Mutations must pass the audited owner/seat RPCs. RLS alone previously allowed
-- delegated members.manage and broad grants included TRUNCATE (which bypasses RLS).
revoke insert,update,delete,truncate,references,trigger on public.organization_memberships,
  public.membership_roles,public.roles,public.role_permissions,public.organization_invitations,
  public.organization_access_requests from public,anon,authenticated;
drop policy if exists memberships_admin_manage on public.organization_memberships;
revoke all on function public.create_organization_invitation(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.create_organization_invitation(uuid,uuid,text,text,text,timestamptz) to service_role;
revoke all on function public.accept_organization_invitation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.accept_organization_invitation(uuid,text,text) to service_role;
revoke all on function public.revoke_organization_invitation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_organization_invitation(uuid,uuid,uuid) to service_role;
revoke all on function public.update_organization_member_access(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_organization_member_access(uuid,uuid,uuid,text,text) to service_role;
revoke all on function public.set_organization_role_permissions(uuid,uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.set_organization_role_permissions(uuid,uuid,text,text[]) to service_role;
revoke all on function public.ensure_organization_role_presets(uuid) from public,anon,authenticated;
grant execute on function public.ensure_organization_role_presets(uuid) to service_role;
