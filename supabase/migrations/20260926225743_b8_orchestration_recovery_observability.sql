alter table public.system_event_deliveries
  add column if not exists retry_count integer not null default 0 check (retry_count >= 0),
  add column if not exists last_retried_at timestamptz,
  add column if not exists last_retried_by text;

create index if not exists system_event_deliveries_failed_idx
  on public.system_event_deliveries(organization_id,created_at)
  where status='failed';

create or replace function public.retry_failed_system_event(
  p_organization_id uuid,
  p_event_id uuid,
  p_actor text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_event public.domain_events%rowtype;
  v_failed integer;
begin
  select * into v_event
  from public.domain_events
  where organization_id=p_organization_id and id=p_event_id
  for update;

  if not found then raise exception 'System event was not found in organization'; end if;
  if v_event.status <> 'failed' then raise exception 'Only failed system events can be retried'; end if;

  select count(*) into v_failed
  from public.system_event_deliveries
  where organization_id=p_organization_id
    and event_id=p_event_id
    and status='failed';

  if v_failed=0 then raise exception 'System event has no failed delivery hops to retry'; end if;

  update public.system_event_deliveries
  set status='pending',
      error_message=null,
      started_at=null,
      completed_at=null,
      retry_count=retry_count+1,
      last_retried_at=now(),
      last_retried_by=nullif(trim(coalesce(p_actor,'')),'')
  where organization_id=p_organization_id
    and event_id=p_event_id
    and status='failed';

  update public.domain_events
  set status='pending',
      available_at=now(),
      last_error=null,
      updated_at=now(),
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'last_retry_requested_at',now(),
        'last_retry_requested_by',nullif(trim(coalesce(p_actor,'')),''),
        'last_retry_reason',nullif(trim(coalesce(p_reason,'')),'')
      )
  where organization_id=p_organization_id and id=p_event_id;

  insert into public.audit_logs(
    organization_id,action,resource_type,resource_id,reason,metadata
  ) values (
    p_organization_id,'system_event.retry_requested','domain_event',p_event_id::text,
    nullif(trim(coalesce(p_reason,'')),''),
    jsonb_build_object(
      'actor',nullif(trim(coalesce(p_actor,'')),''),
      'failed_hops',v_failed,
      'correlation_id',v_event.correlation_id
    )
  );

  return jsonb_build_object(
    'event_id',p_event_id,
    'organization_id',p_organization_id,
    'correlation_id',v_event.correlation_id,
    'failed_hops_requeued',v_failed,
    'status','pending'
  );
end
$$;

revoke all on function public.retry_failed_system_event(uuid,uuid,text,text)
from public,anon,authenticated;
grant execute on function public.retry_failed_system_event(uuid,uuid,text,text)
to service_role;

create or replace function public.get_system_event_chain_diagnostics(
  p_organization_id uuid,
  p_correlation_id uuid
) returns jsonb
language sql
security definer
set search_path=''
stable
as $$
  select jsonb_build_object(
    'organization_id',p_organization_id,
    'correlation_id',p_correlation_id,
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id',e.id,
        'event_type',e.event_type,
        'status',e.status,
        'attempts',e.attempts,
        'source',e.source,
        'source_system',src.slug,
        'target_system',target_direct.slug,
        'causation_id',e.causation_id,
        'last_error',e.last_error,
        'created_at',e.created_at,
        'updated_at',e.updated_at,
        'deliveries',coalesce((
          select jsonb_agg(jsonb_build_object(
            'delivery_id',d.id,
            'route_id',d.route_id,
            'status',d.status,
            'attempt',d.attempt,
            'retry_count',d.retry_count,
            'target_system',dst.slug,
            'dispatch_mode',r.dispatch_mode,
            'error_message',d.error_message,
            'result',d.result,
            'started_at',d.started_at,
            'completed_at',d.completed_at,
            'last_retried_at',d.last_retried_at,
            'last_retried_by',d.last_retried_by
          ) order by r.priority,d.created_at)
          from public.system_event_deliveries d
          join public.system_event_routes r on r.id=d.route_id and r.organization_id=d.organization_id
          join public.organization_systems dos on dos.id=d.target_system_id and dos.organization_id=d.organization_id
          join public.system_catalog dst on dst.id=dos.system_id
          where d.organization_id=e.organization_id and d.event_id=e.id
        ),'[]'::jsonb)
      ) order by e.created_at)
      from public.domain_events e
      left join public.organization_systems sos on sos.id=e.source_system_id and sos.organization_id=e.organization_id
      left join public.system_catalog src on src.id=sos.system_id
      left join public.organization_systems tos on tos.id=e.target_system_id and tos.organization_id=e.organization_id
      left join public.system_catalog target_direct on target_direct.id=tos.system_id
      where e.organization_id=p_organization_id and e.correlation_id=p_correlation_id
    ),'[]'::jsonb)
  );
$$;

revoke all on function public.get_system_event_chain_diagnostics(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.get_system_event_chain_diagnostics(uuid,uuid)
to service_role;
