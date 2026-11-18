import { readFileSync } from 'node:fs';
export const migration = readFileSync('supabase/migrations/20261118091000_owner_only_tenant_manager_access.sql','utf8');
export const org = '10000000-0000-4000-8000-000000000001';
export const otherOrg = '10000000-0000-4000-8000-000000000002';
export const owner = '20000000-0000-4000-8000-000000000001';
export const manager = '20000000-0000-4000-8000-000000000002';
export const newcomer = '20000000-0000-4000-8000-000000000003';
export const another = '20000000-0000-4000-8000-000000000004';
export const bootstrap = `
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;
create schema auth;
create table auth.users(id uuid primary key,email text);
create table public.organizations(id uuid primary key,status text default 'active',seat_limit integer default 3);
create table public.roles(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),slug text,name text,description text,is_system boolean,unique(organization_id,slug));
create table public.permissions(id uuid primary key default gen_random_uuid(),key text unique);
create table public.organization_memberships(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),user_id uuid references auth.users(id),status text,created_at timestamptz default now(),updated_at timestamptz default now(),unique(organization_id,user_id));
create table public.membership_roles(membership_id uuid references organization_memberships(id),role_id uuid references roles(id),created_at timestamptz default now(),primary key(membership_id,role_id));
create table public.role_permissions(role_id uuid references roles(id),permission_id uuid references permissions(id),primary key(role_id,permission_id));
create table public.organization_invitations(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),email text,role_id uuid references roles(id),token_hash text unique,status text,invited_by uuid references auth.users(id),expires_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),revoked_at timestamptz,accepted_by uuid,accepted_at timestamptz);
create unique index invitation_pending_email on organization_invitations(organization_id,lower(email)) where status='pending';
create table public.organization_access_requests(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),requester_user_id uuid references auth.users(id),status text default 'pending',reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),organization_id uuid,actor_user_id uuid,action text,resource_type text,resource_id text,metadata jsonb);
-- Fixture implements only the existing effective entitlement input, not a new production allowance.
create function public.organization_effective_seat_limit(uuid) returns integer language sql as $$select seat_limit from public.organizations where id=$1$$;
grant all on all tables in schema public to service_role,anon,authenticated;
grant usage on schema public,auth to service_role,anon,authenticated;
alter table public.organization_memberships enable row level security;
create policy memberships_admin_manage on public.organization_memberships for all to authenticated using(true) with check(true);
`;
export const seed = `
insert into organizations(id) values('${org}'),('${otherOrg}');
insert into auth.users values('${owner}','owner@example.test'),('${manager}','manager@example.test'),('${newcomer}','new@example.test'),('${another}','another@example.test');
insert into permissions(key) values('members.view'),('members.manage'),('members.invite'),('members.roles.manage'),('organization.owner.transfer'),('billing.view'),('billing.manage'),('customers.manage'),('appointments.manage'),('conversations.reply');
select public.ensure_organization_role_presets('${org}'); select public.ensure_organization_role_presets('${otherOrg}');
insert into organization_memberships(organization_id,user_id,status) values('${org}','${owner}','active'),('${org}','${manager}','active'),('${otherOrg}','${another}','active');
insert into membership_roles(membership_id,role_id) select m.id,r.id from organization_memberships m join roles r on r.organization_id=m.organization_id and r.slug=case when m.user_id='${manager}' then 'manager' else 'owner' end;
`;
export function invite(email='new@example.test',token='a'.repeat(64),actor=owner,organization=org){return `select create_organization_invitation('${organization}','${actor}','${email}','manager','${token}',now()+interval '1 day') as result`;}
export function accept(user=newcomer,email='new@example.test',token='a'.repeat(64)){return `select accept_organization_invitation('${user}','${email}','${token}') as result`;}
export function request(user=newcomer,organization=org){return `insert into organization_access_requests(organization_id,requester_user_id) values('${organization}','${user}') returning id`;}
export function approve(id,actor=owner){return `select approve_organization_access_request('${id}','${actor}') as result`;}
