create index if not exists domain_events_org_created_idx
  on public.domain_events(organization_id,created_at desc);
create index if not exists domain_events_org_source_system_created_idx
  on public.domain_events(organization_id,source_system_id,created_at desc)
  where source_system_id is not null;
create index if not exists human_handoffs_org_source_system_created_idx
  on public.human_handoffs(organization_id,source_system_id,created_at desc)
  where source_system_id is not null;
create index if not exists human_handoffs_org_source_agent_created_idx
  on public.human_handoffs(organization_id,source_agent_id,created_at desc)
  where source_agent_id is not null;
create index if not exists crm_conversations_org_agent_created_idx
  on public.crm_conversations(organization_id,agent_id,created_at desc)
  where agent_id is not null;
create index if not exists runtime_executions_org_agent_created_idx
  on public.runtime_executions(organization_id,agent_id,created_at desc)
  where agent_id is not null;

create or replace function public.get_tenant_analytics_drilldown(
  p_organization_id uuid,
  p_period_days integer default 30
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_days integer := greatest(1,least(coalesce(p_period_days,30),365));
  v_now timestamptz := now();
  v_start timestamptz;
  v_result jsonb;
begin
  if not exists(select 1 from public.organizations where id=p_organization_id) then
    raise exception 'Organization not found';
  end if;
  v_start:=v_now-make_interval(days=>v_days);
  with
  days as (
    select generate_series(date_trunc('day',v_start),date_trunc('day',v_now),interval '1 day') as bucket
  ),
  conversations_daily as (
    select date_trunc('day',created_at) bucket,count(*)::int count
    from public.crm_conversations
    where organization_id=p_organization_id and created_at>=v_start group by 1
  ),
  messages_daily as (
    select date_trunc('day',created_at) bucket,count(*)::int count
    from public.crm_messages
    where organization_id=p_organization_id and created_at>=v_start group by 1
  ),
  handoffs_daily as (
    select date_trunc('day',created_at) bucket,count(*)::int count
    from public.human_handoffs
    where organization_id=p_organization_id and created_at>=v_start group by 1
  ),
  appointments_daily as (
    select date_trunc('day',created_at) bucket,count(*)::int count
    from public.appointments
    where organization_id=p_organization_id and created_at>=v_start group by 1
  ),
  runtime_daily as (
    select date_trunc('day',created_at) bucket,count(*)::int count,
      count(*) filter(where status='failed')::int failed,
      round(avg(latency_ms) filter(where latency_ms is not null)::numeric,0) avg_latency_ms
    from public.runtime_executions
    where organization_id=p_organization_id and created_at>=v_start group by 1
  ),
  whatsapp_daily as (
    select date_trunc('day',created_at) bucket,count(*)::int count,
      count(*) filter(where status='failed')::int failed
    from public.whatsapp_delivery_attempts
    where organization_id=p_organization_id::text and created_at>=v_start group by 1
  ),
  daily as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date',to_char(d.bucket,'YYYY-MM-DD'),
      'conversations',coalesce(c.count,0),
      'messages',coalesce(m.count,0),
      'handoffs',coalesce(h.count,0),
      'appointments',coalesce(a.count,0),
      'runtimeExecutions',coalesce(r.count,0),
      'runtimeFailed',coalesce(r.failed,0),
      'avgLatencyMs',r.avg_latency_ms,
      'whatsappAttempts',coalesce(w.count,0),
      'whatsappFailed',coalesce(w.failed,0)
    ) order by d.bucket),'[]'::jsonb) value
    from days d
    left join conversations_daily c on c.bucket=d.bucket
    left join messages_daily m on m.bucket=d.bucket
    left join handoffs_daily h on h.bucket=d.bucket
    left join appointments_daily a on a.bucket=d.bucket
    left join runtime_daily r on r.bucket=d.bucket
    left join whatsapp_daily w on w.bucket=d.bucket
  ),
  system_metrics as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'organizationSystemId',os.id,'systemCatalogId',sc.id,'slug',sc.slug,'name',sc.name,'status',os.status,
      'events',coalesce(ev.events,0),'eventFailures',coalesce(ev.failures,0),
      'handoffs',coalesce(h.handoffs,0),'appointments',coalesce(ap.appointments,0),
      'confirmedAppointments',coalesce(ap.confirmed,0)
    ) order by sc.display_order,sc.name),'[]'::jsonb) value
    from public.organization_systems os
    join public.system_catalog sc on sc.id=os.system_id
    left join (
      select source_system_id,count(*)::int events,count(*) filter(where status='failed')::int failures
      from public.domain_events
      where organization_id=p_organization_id and created_at>=v_start and source_system_id is not null
      group by source_system_id
    ) ev on ev.source_system_id=os.id
    left join (
      select source_system_id,count(*)::int handoffs
      from public.human_handoffs
      where organization_id=p_organization_id and created_at>=v_start and source_system_id is not null
      group by source_system_id
    ) h on h.source_system_id=os.id
    left join (
      select source_system_id,count(*)::int appointments,
             count(*) filter(where status in ('confirmed','rescheduled'))::int confirmed
      from public.appointments
      where organization_id=p_organization_id and created_at>=v_start and source_system_id is not null
      group by source_system_id
    ) ap on ap.source_system_id=os.id
    where os.organization_id=p_organization_id
  ),
  agent_metrics as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'agentId',a.id,'slug',a.slug,'name',a.name,'status',a.status,'model',a.ai_model,
      'conversations',coalesce(cv.conversations,0),'messages',coalesce(msg.messages,0),
      'runtimeExecutions',coalesce(rx.executions,0),'runtimeFailed',coalesce(rx.failed,0),
      'runtimeSuccessRate',case when coalesce(rx.executions,0)=0 then null else round(((rx.executions-rx.failed)::numeric/rx.executions)*100,1) end,
      'avgLatencyMs',rx.avg_latency_ms,'handoffs',coalesce(h.handoffs,0),
      'aiHandledRate',case when coalesce(cv.conversations,0)=0 then null
        else round(greatest(0,least(100,((cv.conversations-coalesce(h.handoff_conversations,0))::numeric/cv.conversations)*100)),1) end
    ) order by coalesce(rx.executions,0) desc,a.name),'[]'::jsonb) value
    from public.agents a
    left join (
      select agent_id,count(*)::int conversations
      from public.crm_conversations
      where organization_id=p_organization_id and created_at>=v_start and agent_id is not null
      group by agent_id
    ) cv on cv.agent_id=a.id
    left join (
      select agent_id,count(*)::int messages
      from public.crm_messages
      where organization_id=p_organization_id and created_at>=v_start and agent_id is not null
      group by agent_id
    ) msg on msg.agent_id=a.id
    left join (
      select agent_id,count(*)::int executions,count(*) filter(where status='failed')::int failed,
        round(avg(latency_ms) filter(where latency_ms is not null)::numeric,0) avg_latency_ms
      from public.runtime_executions
      where organization_id=p_organization_id and created_at>=v_start and agent_id is not null
      group by agent_id
    ) rx on rx.agent_id=a.id
    left join (
      select source_agent_id,count(*)::int handoffs,count(distinct conversation_id)::int handoff_conversations
      from public.human_handoffs
      where organization_id=p_organization_id and created_at>=v_start and source_agent_id is not null
      group by source_agent_id
    ) h on h.source_agent_id=a.id
    where a.organization_id=p_organization_id
  ),
  handoff_categories as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'category',category,'count',count,'resolved',resolved,'slaTracked',sla_tracked,'slaBreached',sla_breached,
      'slaMetRate',case when sla_tracked=0 then null else round(((sla_tracked-sla_breached)::numeric/sla_tracked)*100,1) end,
      'avgClaimMinutes',avg_claim_minutes,'avgResolutionMinutes',avg_resolution_minutes
    ) order by count desc,category),'[]'::jsonb) value
    from (
      select category,count(*)::int count,count(*) filter(where status in ('resolved','closed'))::int resolved,
        count(*) filter(where sla_due_at is not null)::int sla_tracked,
        count(*) filter(where sla_due_at is not null and coalesce(resolved_at,closed_at,v_now)>sla_due_at)::int sla_breached,
        round(avg(extract(epoch from (claimed_at-created_at))/60.0) filter(where claimed_at is not null)::numeric,1) avg_claim_minutes,
        round(avg(extract(epoch from (coalesce(resolved_at,closed_at)-created_at))/60.0)
          filter(where coalesce(resolved_at,closed_at) is not null)::numeric,1) avg_resolution_minutes
      from public.human_handoffs
      where organization_id=p_organization_id and created_at>=v_start
      group by category
    ) q
  ),
  assignees as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'membershipId',assigned_membership_id,'assigned',assigned,'claimed',claimed,'resolved',resolved,'open',open_count,
      'slaTracked',sla_tracked,'slaBreached',sla_breached,
      'slaMetRate',case when sla_tracked=0 then null else round(((sla_tracked-sla_breached)::numeric/sla_tracked)*100,1) end,
      'avgClaimMinutes',avg_claim_minutes,'avgResolutionMinutes',avg_resolution_minutes
    ) order by assigned desc,assigned_membership_id),'[]'::jsonb) value
    from (
      select assigned_membership_id,count(*)::int assigned,count(*) filter(where claimed_at is not null)::int claimed,
        count(*) filter(where status in ('resolved','closed'))::int resolved,
        count(*) filter(where status not in ('resolved','closed'))::int open_count,
        count(*) filter(where sla_due_at is not null)::int sla_tracked,
        count(*) filter(where sla_due_at is not null and coalesce(resolved_at,closed_at,v_now)>sla_due_at)::int sla_breached,
        round(avg(extract(epoch from (claimed_at-created_at))/60.0) filter(where claimed_at is not null)::numeric,1) avg_claim_minutes,
        round(avg(extract(epoch from (coalesce(resolved_at,closed_at)-created_at))/60.0)
          filter(where coalesce(resolved_at,closed_at) is not null)::numeric,1) avg_resolution_minutes
      from public.human_handoffs
      where organization_id=p_organization_id and created_at>=v_start and assigned_membership_id is not null
      group by assigned_membership_id
    ) q
  ),
  transitions as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'fromStageId',q.from_stage_id,'fromStage',coalesce(fs.name,'No stage'),
      'toStageId',q.to_stage_id,'toStage',ts.name,'count',q.count
    ) order by q.count desc,coalesce(fs.name,'No stage'),ts.name),'[]'::jsonb) value
    from (
      select from_stage_id,to_stage_id,count(*)::int count
      from public.customer_stage_history
      where organization_id=p_organization_id and changed_at>=v_start
      group by from_stage_id,to_stage_id
    ) q
    left join public.organization_customer_stages fs on fs.organization_id=p_organization_id and fs.id=q.from_stage_id
    join public.organization_customer_stages ts on ts.organization_id=p_organization_id and ts.id=q.to_stage_id
  )
  select jsonb_build_object(
    'organizationId',p_organization_id,'generatedAt',v_now,'periodDays',v_days,'periodStart',v_start,
    'daily',d.value,'systems',sm.value,'agents',am.value,'handoffCategories',hc.value,'assignees',asg.value,'stageTransitions',tr.value
  )
  into v_result
  from daily d,system_metrics sm,agent_metrics am,handoff_categories hc,assignees asg,transitions tr;
  return v_result;
end $$;

revoke all on function public.get_tenant_analytics_drilldown(uuid,integer)
from public,anon,authenticated;
grant execute on function public.get_tenant_analytics_drilldown(uuid,integer)
to service_role;
