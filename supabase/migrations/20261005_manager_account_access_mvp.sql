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
