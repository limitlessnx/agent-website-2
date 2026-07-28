-- Fluxknight organization ownership and notification isolation

alter table if exists public.organizations
  add column if not exists organization_type text not null default 'client'
  check (organization_type in ('platform', 'owned', 'client'));

alter table if exists public.organizations
  add column if not exists parent_organization_id uuid references public.organizations(id) on delete set null;

alter table if exists public.organizations
  add column if not exists is_fluxknight_managed boolean not null default false;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  scope text not null default 'organization' check (scope in ('platform_admin', 'organization')),
  event_type text not null,
  title text not null,
  message text,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_organization_created_idx
  on public.notifications (organization_id, created_at desc);
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index if not exists notifications_scope_created_idx
  on public.notifications (scope, created_at desc);

alter table public.notifications enable row level security;

-- Clients see notifications addressed to them or belonging to an organization they belong to.
create policy "organization members read notifications"
on public.notifications for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or (
    scope = 'organization'
    and organization_id in (
      select organization_id
      from public.organization_memberships
      where user_id = auth.uid()
    )
  )
);

-- Service-role/server actions create and update notifications.
-- Platform-admin reads should be performed by trusted server routes after admin verification.

update public.organizations
set organization_type = 'owned', is_fluxknight_managed = true
where lower(name) in ('limitless realty', 'gencouv');

update public.organizations
set organization_type = 'platform', is_fluxknight_managed = true
where lower(name) = 'fluxknight';
