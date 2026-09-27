create table if not exists public.system_event_route_templates (
  id uuid primary key default gen_random_uuid(),
  source_system_catalog_id uuid not null references public.system_catalog(id) on delete cascade,
  event_type text not null,
  target_system_catalog_id uuid not null references public.system_catalog(id) on delete cascade,
  dispatch_mode text not null default 'auto' check (dispatch_mode in ('auto','agent_runtime','workflow_adapter')),
  status text not null default 'active' check (status in ('active','disabled')),
  priority integer not null default 100 check (priority between 1 and 1000),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system_catalog_id,event_type,target_system_catalog_id)
);
alter table public.system_event_routes
  add column if not exists template_id uuid references public.system_event_route_templates(id) on delete set null,
  add column if not exists dispatch_mode text not null default 'auto' check (dispatch_mode in ('auto','agent_runtime','workflow_adapter'));
alter table public.system_event_route_templates enable row level security;
revoke all on public.system_event_route_templates from anon, authenticated;
insert into public.system_event_route_templates(source_system_catalog_id,event_type,target_system_catalog_id,dispatch_mode,priority,configuration)
select s.id,'appointment.requested',t.id,'workflow_adapter',100,'{"adapter":"appointment"}'::jsonb from public.system_catalog s, public.system_catalog t where s.slug='whatsapp-agent' and t.slug='appointment-system'
on conflict (source_system_catalog_id,event_type,target_system_catalog_id) do update set dispatch_mode=excluded.dispatch_mode,priority=excluded.priority,configuration=excluded.configuration,status='active';
insert into public.system_event_route_templates(source_system_catalog_id,event_type,target_system_catalog_id,dispatch_mode,priority,configuration)
select s.id,'follow_up.requested',t.id,'workflow_adapter',110,'{"adapter":"follow_up"}'::jsonb from public.system_catalog s, public.system_catalog t where s.slug='whatsapp-agent' and t.slug='follow-up-system'
on conflict (source_system_catalog_id,event_type,target_system_catalog_id) do update set dispatch_mode=excluded.dispatch_mode,priority=excluded.priority,configuration=excluded.configuration,status='active';
insert into public.system_event_route_templates(source_system_catalog_id,event_type,target_system_catalog_id,dispatch_mode,priority,configuration)
select s.id,'appointment.requested',t.id,'workflow_adapter',100,'{"adapter":"appointment"}'::jsonb from public.system_catalog s, public.system_catalog t where s.slug='support-agent' and t.slug='appointment-system'
on conflict (source_system_catalog_id,event_type,target_system_catalog_id) do update set dispatch_mode=excluded.dispatch_mode,priority=excluded.priority,configuration=excluded.configuration,status='active';
insert into public.system_event_route_templates(source_system_catalog_id,event_type,target_system_catalog_id,dispatch_mode,priority,configuration)
select s.id,'follow_up.requested',t.id,'workflow_adapter',110,'{"adapter":"follow_up"}'::jsonb from public.system_catalog s, public.system_catalog t where s.slug='support-agent' and t.slug='follow-up-system'
on conflict (source_system_catalog_id,event_type,target_system_catalog_id) do update set dispatch_mode=excluded.dispatch_mode,priority=excluded.priority,configuration=excluded.configuration,status='active';
insert into public.system_event_route_templates(source_system_catalog_id,event_type,target_system_catalog_id,dispatch_mode,priority,configuration)
select s.id,'appointment.booked',t.id,'workflow_adapter',120,'{"adapter":"follow_up"}'::jsonb from public.system_catalog s, public.system_catalog t where s.slug='appointment-system' and t.slug='follow-up-system'
on conflict (source_system_catalog_id,event_type,target_system_catalog_id) do update set dispatch_mode=excluded.dispatch_mode,priority=excluded.priority,configuration=excluded.configuration,status='active';
insert into public.system_event_route_templates(source_system_catalog_id,event_type,target_system_catalog_id,dispatch_mode,priority,configuration)
select s.id,'lead.created',t.id,'workflow_adapter',120,'{"adapter":"follow_up"}'::jsonb from public.system_catalog s, public.system_catalog t where s.slug='lead-generation' and t.slug='follow-up-system'
on conflict (source_system_catalog_id,event_type,target_system_catalog_id) do update set dispatch_mode=excluded.dispatch_mode,priority=excluded.priority,configuration=excluded.configuration,status='active';
create or replace function public.sync_organization_system_event_routes(p_organization_id uuid) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_inserted integer:=0; v_disabled integer:=0;
begin
 if not exists(select 1 from public.organizations where id=p_organization_id) then raise exception 'Organization not found'; end if;
 update public.system_event_routes r set status='disabled',updated_at=now()
 where r.organization_id=p_organization_id and r.template_id is not null and not exists(
   select 1 from public.system_event_route_templates rt
   join public.organization_systems src on src.organization_id=p_organization_id and src.system_id=rt.source_system_catalog_id and src.id=r.source_system_id and src.status='active'
   join public.organization_systems dst on dst.organization_id=p_organization_id and dst.system_id=rt.target_system_catalog_id and dst.id=r.target_system_id and dst.status='active'
   where rt.id=r.template_id and rt.status='active');
 get diagnostics v_disabled=row_count;
 insert into public.system_event_routes(organization_id,source_system_id,event_type,target_system_id,status,priority,configuration,template_id,dispatch_mode)
 select p_organization_id,src.id,rt.event_type,dst.id,'active',rt.priority,rt.configuration,rt.id,rt.dispatch_mode
 from public.system_event_route_templates rt
 join public.organization_systems src on src.organization_id=p_organization_id and src.system_id=rt.source_system_catalog_id and src.status='active'
 join public.organization_systems dst on dst.organization_id=p_organization_id and dst.system_id=rt.target_system_catalog_id and dst.status='active'
 where rt.status='active' and public.organization_can_use_system(p_organization_id,src.system_id) and public.organization_can_use_system(p_organization_id,dst.system_id)
 on conflict (organization_id,source_system_id,event_type,target_system_id)
 do update set status='active',priority=excluded.priority,configuration=excluded.configuration,template_id=excluded.template_id,dispatch_mode=excluded.dispatch_mode,updated_at=now();
 get diagnostics v_inserted=row_count;
 return jsonb_build_object('organization_id',p_organization_id,'routes_synced',v_inserted,'routes_disabled',v_disabled);
end $$;
revoke all on function public.sync_organization_system_event_routes(uuid) from public,anon,authenticated;
grant execute on function public.sync_organization_system_event_routes(uuid) to service_role;