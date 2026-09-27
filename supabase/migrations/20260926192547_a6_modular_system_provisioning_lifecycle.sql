-- A6: modular system request, provision, test and activate lifecycle
insert into public.organization_entitlements(organization_id,feature_key,enabled,source,configuration)
select os.organization_id,'system.'||sc.slug,true,'admin',
 jsonb_build_object('organization_system_id',os.id,'legacy_grandfathered',true,'grandfathered_at',now())
from public.organization_systems os join public.system_catalog sc on sc.id=os.system_id
where not exists(select 1 from public.organization_service_packages osp where osp.organization_id=os.organization_id and osp.status='active')
and not exists(select 1 from public.organization_entitlements e where e.organization_id=os.organization_id and e.feature_key='system.'||sc.slug);

create or replace function public.request_organization_system_installation(p_organization_id uuid,p_system_slug text,p_configuration jsonb default '{}'::jsonb,p_actor_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_system public.system_catalog%rowtype; v_existing public.organization_systems%rowtype; v_limit numeric; v_count integer; v_installation_id uuid;
begin
 if not exists(select 1 from public.organizations where id=p_organization_id and status='active') then raise exception 'Active organization not found'; end if;
 select * into v_system from public.system_catalog where slug=p_system_slug and status='available' limit 1;
 if not found then raise exception 'Available system not found'; end if;
 select * into v_existing from public.organization_systems where organization_id=p_organization_id and system_id=v_system.id limit 1 for update;
 if v_existing.id is not null and v_existing.status<>'archived' then
  update public.organization_systems set configuration=coalesce(configuration,'{}'::jsonb)||coalesce(p_configuration,'{}'::jsonb),updated_at=now()
  where id=v_existing.id returning id into v_installation_id;
  return jsonb_build_object('ok',true,'idempotent',true,'organization_system_id',v_installation_id,'organization_id',p_organization_id,'system_id',v_system.id,'system_slug',v_system.slug,'status',v_existing.status);
 end if;
 if not public.organization_can_use_system(p_organization_id,v_system.id) then raise exception 'System is not included in this organization package or entitlement'; end if;
 v_limit:=public.organization_effective_limit(p_organization_id,'systems.max_active',3);
 select count(*) into v_count from public.organization_systems where organization_id=p_organization_id and status<>'archived';
 if v_limit is not null and v_count>=floor(v_limit)::integer then raise exception 'Organization system limit reached'; end if;
 if v_existing.id is null then
  insert into public.organization_systems(organization_id,system_id,status,configuration,requested_by,requested_at,metadata)
  values(p_organization_id,v_system.id,'setup_required',coalesce(p_configuration,'{}'::jsonb),p_actor_user_id,now(),jsonb_build_object('requested_via','super_admin'))
  returning id into v_installation_id;
 else
  update public.organization_systems set status='setup_required',configuration=coalesce(p_configuration,'{}'::jsonb),requested_by=p_actor_user_id,requested_at=now(),approved_at=null,activated_at=null,last_error=null,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('rerequested_at',now()),updated_at=now()
  where id=v_existing.id returning id into v_installation_id;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(p_organization_id,p_actor_user_id,'organization.system_requested','organization_system',v_installation_id::text,jsonb_build_object('system_slug',v_system.slug,'system_id',v_system.id));
 return jsonb_build_object('ok',true,'idempotent',false,'organization_system_id',v_installation_id,'organization_id',p_organization_id,'system_id',v_system.id,'system_slug',v_system.slug,'status','setup_required');
end; $$;
revoke all on function public.request_organization_system_installation(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.request_organization_system_installation(uuid,text,jsonb,uuid) to service_role;

create or replace function public.assert_organization_system_provisionable(p_installation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_installation public.organization_systems%rowtype; v_system public.system_catalog%rowtype; v_limit numeric; v_count integer;
begin
 select * into v_installation from public.organization_systems where id=p_installation_id limit 1;
 if not found then raise exception 'Organization system installation not found'; end if;
 if v_installation.status='archived' then raise exception 'Archived system cannot be provisioned'; end if;
 select * into v_system from public.system_catalog where id=v_installation.system_id limit 1;
 if not found or v_system.status<>'available' then raise exception 'System is unavailable'; end if;
 if not public.organization_can_use_system(v_installation.organization_id,v_installation.system_id) then raise exception 'System entitlement is no longer active'; end if;
 v_limit:=public.organization_effective_limit(v_installation.organization_id,'systems.max_active',3);
 select count(*) into v_count from public.organization_systems where organization_id=v_installation.organization_id and status<>'archived';
 if v_limit is not null and v_count>floor(v_limit)::integer then raise exception 'Organization exceeds its active system allowance'; end if;
 return jsonb_build_object('ok',true,'organization_system_id',v_installation.id,'organization_id',v_installation.organization_id,'system_id',v_system.id,'system_slug',v_system.slug,'status',v_installation.status);
end; $$;
revoke all on function public.assert_organization_system_provisionable(uuid) from public,anon,authenticated;
grant execute on function public.assert_organization_system_provisionable(uuid) to service_role;

create or replace function public.record_organization_system_test(p_installation_id uuid,p_passed boolean,p_details jsonb default '{}'::jsonb,p_actor_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_installation public.organization_systems%rowtype; v_status text;
begin
 select * into v_installation from public.organization_systems where id=p_installation_id limit 1 for update;
 if not found then raise exception 'Organization system installation not found'; end if;
 if v_installation.status not in ('testing','needs_attention') then raise exception 'System must be in testing or needs_attention state'; end if;
 v_status:=case when p_passed then 'testing' else 'needs_attention' end;
 update public.organization_systems set status=v_status,last_error=case when p_passed then null else coalesce(p_details->>'error','System readiness test failed') end,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('test_passed',p_passed,'last_tested_at',now(),'test_details',coalesce(p_details,'{}'::jsonb)),updated_at=now()
 where id=p_installation_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(v_installation.organization_id,p_actor_user_id,case when p_passed then 'organization.system_test_passed' else 'organization.system_test_failed' end,'organization_system',p_installation_id::text,coalesce(p_details,'{}'::jsonb));
 return jsonb_build_object('ok',true,'organization_system_id',p_installation_id,'passed',p_passed,'status',v_status);
end; $$;
revoke all on function public.record_organization_system_test(uuid,boolean,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.record_organization_system_test(uuid,boolean,jsonb,uuid) to service_role;

create or replace function public.activate_organization_system_record(p_installation_id uuid,p_actor_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_installation public.organization_systems%rowtype; v_test_passed boolean;
begin
 select * into v_installation from public.organization_systems where id=p_installation_id limit 1 for update;
 if not found then raise exception 'Organization system installation not found'; end if;
 if v_installation.status='active' then return jsonb_build_object('ok',true,'idempotent',true,'organization_system_id',p_installation_id,'status','active'); end if;
 if v_installation.status<>'testing' then raise exception 'System must pass testing before activation'; end if;
 v_test_passed:=coalesce((v_installation.metadata->>'test_passed')::boolean,false);
 if not v_test_passed then raise exception 'System readiness test has not passed'; end if;
 perform public.assert_organization_system_provisionable(p_installation_id);
 update public.organization_systems set status='active',activated_at=now(),last_error=null,updated_at=now() where id=p_installation_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(v_installation.organization_id,p_actor_user_id,'organization.system_activated','organization_system',p_installation_id::text,jsonb_build_object('activated_at',now()));
 return jsonb_build_object('ok',true,'idempotent',false,'organization_system_id',p_installation_id,'status','active');
end; $$;
revoke all on function public.activate_organization_system_record(uuid,uuid) from public,anon,authenticated;
grant execute on function public.activate_organization_system_record(uuid,uuid) to service_role;
