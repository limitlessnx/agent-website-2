-- Manager account mode + organization access request MVP
alter table public.organizations
  add column if not exists manager_access_code text;

update public.organizations
set manager_access_code = 'FLX-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
where manager_access_code is null;

alter table public.organizations
  alter column manager_access_code set not null;

create unique index if not exists organizations_manager_access_code_key
  on public.organizations(manager_access_code);

create table if not exists public.client_account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_mode text not null default 'organization'
    check (account_mode in ('organization','manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_access_requests_pending_key
  on public.organization_access_requests(organization_id, requester_user_id)
  where status = 'pending';

alter table public.client_account_profiles enable row level security;
alter table public.organization_access_requests enable row level security;

create policy "client account profile owner can read"
  on public.client_account_profiles for select
  to authenticated using (user_id = auth.uid());

create policy "client account profile owner can insert"
  on public.client_account_profiles for insert
  to authenticated with check (user_id = auth.uid());

create policy "client account profile owner can update"
  on public.client_account_profiles for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "organization members can read access requests"
  on public.organization_access_requests for select
  to authenticated using (
    requester_user_id = auth.uid()
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_access_requests.organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "manager can create own access request"
  on public.organization_access_requests for insert
  to authenticated with check (requester_user_id = auth.uid());

create index if not exists organization_access_requests_requester_idx
  on public.organization_access_requests(requester_user_id, status, created_at desc);

create index if not exists organization_access_requests_org_idx
  on public.organization_access_requests(organization_id, status, created_at desc);

create or replace function public.request_organization_access(
  p_access_code text,
  p_requester_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_request_id uuid;
begin
  select id into v_org_id
  from public.organizations
  where upper(manager_access_code) = upper(trim(p_access_code))
    and status = 'active'
  limit 1;

  if v_org_id is null then
    raise exception 'Organization access ID is invalid.';
  end if;

  if exists (
    select 1 from public.organization_memberships
    where organization_id = v_org_id
      and user_id = p_requester_user_id
      and status = 'active'
  ) then
    raise exception 'You already have access to this organization.';
  end if;

  insert into public.organization_access_requests(organization_id, requester_user_id)
  values (v_org_id, p_requester_user_id)
  on conflict (organization_id, requester_user_id) where status = 'pending'
  do update set updated_at = now()
  returning id into v_request_id;

  return jsonb_build_object('request_id', v_request_id, 'organization_id', v_org_id, 'status', 'pending');
end;
$$;

create or replace function public.approve_organization_access_request(
  p_request_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.organization_access_requests%rowtype;
  v_role_id uuid;
  v_membership_id uuid;
begin
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
      and r.slug in ('owner','admin')
  ) then
    raise exception 'Organization admin access required.';
  end if;

  select id into v_role_id
  from public.roles
  where organization_id = v_request.organization_id
    and slug = 'manager'
  limit 1;

  if v_role_id is null then
    select id into v_role_id
    from public.roles
    where organization_id = v_request.organization_id
      and slug = 'owner'
    limit 1;
  end if;

  if v_role_id is null then
    raise exception 'Manager role is not configured for this organization.';
  end if;

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

  insert into public.membership_roles(membership_id, role_id)
  values (v_membership_id, v_role_id)
  on conflict do nothing;

  update public.organization_access_requests
  set status = 'approved', reviewed_by = p_actor_user_id, reviewed_at = now(), updated_at = now()
  where id = v_request.id;

  return jsonb_build_object('organization_id', v_request.organization_id, 'membership_id', v_membership_id, 'status', 'approved');
end;
$$;

create or replace function public.reject_organization_access_request(
  p_request_id uuid,
  p_actor_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
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
      and r.slug in ('owner','admin')
  ) then
    raise exception 'Organization admin access required.';
  end if;

  update public.organization_access_requests
  set status = 'rejected', reviewed_by = p_actor_user_id, reviewed_at = now(), updated_at = now()
  where id = p_request_id and status = 'pending';

  return true;
end;
$$;
