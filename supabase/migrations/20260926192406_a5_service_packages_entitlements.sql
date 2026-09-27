-- A5: authoritative service packages, seats and entitlements
create table if not exists public.service_package_entitlements (
 id uuid primary key default gen_random_uuid(),
 service_package_id uuid not null references public.service_packages(id) on delete cascade,
 feature_key text not null, enabled boolean not null default true, limit_value numeric,
 configuration jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(service_package_id,feature_key)
);
create table if not exists public.service_package_systems (
 id uuid primary key default gen_random_uuid(),
 service_package_id uuid not null references public.service_packages(id) on delete cascade,
 system_id uuid not null references public.system_catalog(id) on delete cascade,
 enabled boolean not null default true, configuration jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(service_package_id,system_id)
);
create table if not exists public.organization_service_packages (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 service_package_id uuid not null references public.service_packages(id) on delete restrict,
 status text not null default 'active' check(status in ('active','paused','expired','cancelled')),
 source text not null default 'super_admin', assigned_by uuid references auth.users(id) on delete set null,
 starts_at timestamptz not null default now(), ends_at timestamptz, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists organization_service_packages_one_active_idx on public.organization_service_packages(organization_id) where status='active';
create index if not exists organization_service_packages_org_status_idx on public.organization_service_packages(organization_id,status);
create index if not exists service_package_entitlements_package_idx on public.service_package_entitlements(service_package_id,feature_key);
create index if not exists service_package_systems_package_idx on public.service_package_systems(service_package_id,system_id);

alter table public.service_package_entitlements enable row level security;
alter table public.service_package_systems enable row level security;
alter table public.organization_service_packages enable row level security;
revoke all on table public.service_package_entitlements,public.service_package_systems from public,anon,authenticated;
revoke all on table public.organization_service_packages from public,anon,authenticated;
grant all on table public.service_package_entitlements,public.service_package_systems,public.organization_service_packages to service_role;
grant select on table public.organization_service_packages to authenticated;
create policy organization_service_packages_member_select on public.organization_service_packages for select to authenticated using(public.is_organization_member(organization_id));

insert into public.service_package_entitlements(service_package_id,feature_key,enabled,limit_value,configuration)
select id,'team.seats',true,3,'{}'::jsonb from public.service_packages where status='active'
on conflict(service_package_id,feature_key) do nothing;
insert into public.service_package_entitlements(service_package_id,feature_key,enabled,limit_value,configuration)
select id,'systems.max_active',true,case slug when 'starter' then 3 when 'growth' then 6 when 'enterprise' then null else 3 end,'{}'::jsonb
from public.service_packages where status='active'
on conflict(service_package_id,feature_key) do nothing;

create or replace function public.organization_active_service_package(p_organization_id uuid)
returns uuid language sql stable security definer set search_path='' as $$
 select osp.service_package_id from public.organization_service_packages osp
 where osp.organization_id=p_organization_id and osp.status='active' and osp.starts_at<=now()
 and (osp.ends_at is null or osp.ends_at>now()) order by osp.starts_at desc limit 1
$$;
revoke all on function public.organization_active_service_package(uuid) from public,anon,authenticated;
grant execute on function public.organization_active_service_package(uuid) to service_role;

create or replace function public.organization_feature_enabled(p_organization_id uuid,p_feature_key text,p_default boolean default false)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_enabled boolean; v_package_id uuid;
begin
 select e.enabled into v_enabled from public.organization_entitlements e
 where e.organization_id=p_organization_id and e.feature_key=p_feature_key and (e.expires_at is null or e.expires_at>now())
 order by e.updated_at desc limit 1;
 if found then return v_enabled; end if;
 v_package_id:=public.organization_active_service_package(p_organization_id);
 if v_package_id is null then return p_default; end if;
 select e.enabled into v_enabled from public.service_package_entitlements e where e.service_package_id=v_package_id and e.feature_key=p_feature_key limit 1;
 if found then return v_enabled; end if; return p_default;
end; $$;
revoke all on function public.organization_feature_enabled(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.organization_feature_enabled(uuid,text,boolean) to service_role;

create or replace function public.organization_effective_limit(p_organization_id uuid,p_feature_key text,p_default numeric default null)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare v_enabled boolean; v_limit numeric; v_package_id uuid;
begin
 select e.enabled,e.limit_value into v_enabled,v_limit from public.organization_entitlements e
 where e.organization_id=p_organization_id and e.feature_key=p_feature_key and (e.expires_at is null or e.expires_at>now())
 order by e.updated_at desc limit 1;
 if found then if not v_enabled then return 0; end if; return v_limit; end if;
 v_package_id:=public.organization_active_service_package(p_organization_id);
 if v_package_id is not null then
  select e.enabled,e.limit_value into v_enabled,v_limit from public.service_package_entitlements e
  where e.service_package_id=v_package_id and e.feature_key=p_feature_key limit 1;
  if found then if not v_enabled then return 0; end if; return v_limit; end if;
 end if;
 return p_default;
end; $$;
revoke all on function public.organization_effective_limit(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.organization_effective_limit(uuid,text,numeric) to service_role;

create or replace function public.organization_effective_seat_limit(p_organization_id uuid)
returns integer language plpgsql stable security definer set search_path='' as $$
declare v_limit numeric;
begin
 v_limit:=public.organization_effective_limit(p_organization_id,'team.seats',3);
 if v_limit is null then return 1000000; end if;
 return greatest(1,floor(v_limit)::integer);
end; $$;
revoke all on function public.organization_effective_seat_limit(uuid) from public,anon,authenticated;
grant execute on function public.organization_effective_seat_limit(uuid) to service_role;

create or replace function public.assign_service_package_to_organization(p_organization_id uuid,p_package_slug text,p_actor_user_id uuid default null,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_package public.service_packages%rowtype; v_existing public.organization_service_packages%rowtype; v_assignment_id uuid;
begin
 if not exists(select 1 from public.organizations where id=p_organization_id and status='active') then raise exception 'Active organization not found'; end if;
 select * into v_package from public.service_packages where slug=p_package_slug and status='active' limit 1;
 if not found then raise exception 'Active service package not found'; end if;
 select * into v_existing from public.organization_service_packages where organization_id=p_organization_id and status='active' limit 1 for update;
 if v_existing.id is not null and v_existing.service_package_id=v_package.id then
  update public.organization_service_packages set metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb),updated_at=now() where id=v_existing.id returning id into v_assignment_id;
 else
  update public.organization_service_packages set status='paused',ends_at=coalesce(ends_at,now()),updated_at=now() where organization_id=p_organization_id and status='active';
  insert into public.organization_service_packages(organization_id,service_package_id,status,source,assigned_by,metadata)
  values(p_organization_id,v_package.id,'active','super_admin',p_actor_user_id,coalesce(p_metadata,'{}'::jsonb)) returning id into v_assignment_id;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(p_organization_id,p_actor_user_id,'organization.package_assigned','organization_service_package',v_assignment_id::text,jsonb_build_object('package_slug',v_package.slug,'package_id',v_package.id));
 return jsonb_build_object('ok',true,'assignment_id',v_assignment_id,'organization_id',p_organization_id,'package_id',v_package.id,'package_slug',v_package.slug,'team_seats',public.organization_effective_seat_limit(p_organization_id),'systems_max_active',public.organization_effective_limit(p_organization_id,'systems.max_active',3));
end; $$;
revoke all on function public.assign_service_package_to_organization(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.assign_service_package_to_organization(uuid,text,uuid,jsonb) to service_role;

create or replace function public.organization_can_use_system(p_organization_id uuid,p_system_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_slug text; v_override boolean; v_package_id uuid; v_package_has_system_rules boolean;
begin
 select slug into v_slug from public.system_catalog where id=p_system_id and status='available';
 if v_slug is null then return false; end if;
 select enabled into v_override from public.organization_entitlements where organization_id=p_organization_id and feature_key='system.'||v_slug and (expires_at is null or expires_at>now()) order by updated_at desc limit 1;
 if found then return v_override; end if;
 v_package_id:=public.organization_active_service_package(p_organization_id);
 if v_package_id is null then return false; end if;
 select exists(select 1 from public.service_package_systems where service_package_id=v_package_id) into v_package_has_system_rules;
 if not v_package_has_system_rules then return true; end if;
 return exists(select 1 from public.service_package_systems where service_package_id=v_package_id and system_id=p_system_id and enabled=true);
end; $$;
revoke all on function public.organization_can_use_system(uuid,uuid) from public,anon,authenticated;
grant execute on function public.organization_can_use_system(uuid,uuid) to service_role;
