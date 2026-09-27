create index if not exists crm_customers_org_created_idx
  on public.crm_customers(organization_id,created_at desc);
create index if not exists crm_conversations_org_created_idx
  on public.crm_conversations(organization_id,created_at desc);
create index if not exists crm_messages_org_created_idx
  on public.crm_messages(organization_id,created_at desc);
create index if not exists runtime_executions_org_created_idx
  on public.runtime_executions(organization_id,created_at desc);
create index if not exists runtime_tool_calls_org_created_idx
  on public.runtime_tool_calls(organization_id,created_at desc);
create index if not exists appointments_org_created_idx
  on public.appointments(organization_id,created_at desc);
create index if not exists customer_stage_history_org_changed_idx
  on public.customer_stage_history(organization_id,changed_at desc);

create or replace function public.get_tenant_operational_analytics(
  p_organization_id uuid,
  p_period_days integer default 30
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_period_days,30), 365));
  v_now timestamptz := now();
  v_start timestamptz;
  v_previous_start timestamptz;
  v_result jsonb;
begin
  if not exists(select 1 from public.organizations where id=p_organization_id) then
    raise exception 'Organization not found';
  end if;

  v_start := v_now - make_interval(days=>v_days);
  v_previous_start := v_now - make_interval(days=>v_days*2);

  with
  customer_metrics as (
    select
      count(*)::int total,
      count(*) filter(where created_at>=v_start)::int current_new,
      count(*) filter(where created_at>=v_previous_start and created_at<v_start)::int previous_new
    from public.crm_customers
    where organization_id=p_organization_id
  ),
  conversation_metrics as (
    select
      count(*) filter(where created_at>=v_start)::int current_count,
      count(*) filter(where created_at>=v_previous_start and created_at<v_start)::int previous_count,
      count(distinct customer_id) filter(where created_at>=v_start)::int current_customers
    from public.crm_conversations
    where organization_id=p_organization_id and created_at>=v_previous_start
  ),
  message_metrics as (
    select
      count(*) filter(where created_at>=v_start)::int current_count,
      count(*) filter(where created_at>=v_previous_start and created_at<v_start)::int previous_count,
      count(*) filter(where created_at>=v_start and sender_type='agent')::int ai_messages,
      count(*) filter(where created_at>=v_start and sender_type='human')::int human_messages,
      count(*) filter(where created_at>=v_start and sender_type='customer')::int customer_messages
    from public.crm_messages
    where organization_id=p_organization_id and created_at>=v_previous_start
  ),
  handoff_metrics as (
    select
      count(*) filter(where created_at>=v_start)::int current_count,
      count(*) filter(where created_at>=v_previous_start and created_at<v_start)::int previous_count,
      count(distinct conversation_id) filter(where created_at>=v_start)::int current_conversations,
      count(*) filter(where created_at>=v_start and status in ('resolved','closed'))::int resolved,
      count(*) filter(where created_at>=v_start and assigned_membership_id is not null)::int assigned,
      count(*) filter(where created_at>=v_start and sla_due_at is not null and
        coalesce(resolved_at,closed_at,v_now)>sla_due_at)::int sla_breached,
      count(*) filter(where created_at>=v_start and follow_up_required=true)::int follow_up_required,
      count(*) filter(where created_at>=v_start and follow_up_status='completed')::int follow_up_completed,
      round(avg(extract(epoch from (claimed_at-created_at))/60.0)
        filter(where created_at>=v_start and claimed_at is not null)::numeric,1) avg_claim_minutes,
      round(avg(extract(epoch from (coalesce(resolved_at,closed_at)-created_at))/60.0)
        filter(where created_at>=v_start and coalesce(resolved_at,closed_at) is not null)::numeric,1) avg_resolution_minutes
    from public.human_handoffs
    where organization_id=p_organization_id and created_at>=v_previous_start
  ),
  appointment_metrics as (
    select
      count(*) filter(where created_at>=v_start)::int current_count,
      count(*) filter(where created_at>=v_previous_start and created_at<v_start)::int previous_count,
      count(*) filter(where created_at>=v_start and status in ('confirmed','rescheduled'))::int confirmed,
      count(*) filter(where created_at>=v_start and status='cancelled')::int cancelled,
      count(*) filter(where created_at>=v_start and status='failed')::int failed
    from public.appointments
    where organization_id=p_organization_id and created_at>=v_previous_start
  ),
  runtime_metrics as (
    select
      count(*) filter(where created_at>=v_start)::int current_count,
      count(*) filter(where created_at>=v_previous_start and created_at<v_start)::int previous_count,
      count(*) filter(where created_at>=v_start and status in ('succeeded','completed','success'))::int succeeded,
      count(*) filter(where created_at>=v_start and status='failed')::int failed,
      round(avg(latency_ms) filter(where created_at>=v_start and latency_ms is not null)::numeric,0) avg_latency_ms,
      coalesce(sum(cost_minor) filter(where created_at>=v_start),0)::bigint cost_minor
    from public.runtime_executions
    where organization_id=p_organization_id and created_at>=v_previous_start
  ),
  tool_metrics as (
    select
      count(*) filter(where created_at>=v_start)::int current_count,
      count(*) filter(where created_at>=v_start and status in ('succeeded','completed','success'))::int succeeded,
      count(*) filter(where created_at>=v_start and status='failed')::int failed
    from public.runtime_tool_calls
    where organization_id=p_organization_id and created_at>=v_start
  ),
  whatsapp_metrics as (
    select
      count(*) filter(where created_at>=v_start)::int current_count,
      count(*) filter(where created_at>=v_previous_start and created_at<v_start)::int previous_count,
      count(*) filter(where created_at>=v_start and status in ('sent','delivered','read','accepted'))::int successful,
      count(*) filter(where created_at>=v_start and status='failed')::int failed,
      count(*) filter(where created_at>=v_start and status='read')::int read
    from public.whatsapp_delivery_attempts
    where organization_id=p_organization_id::text and created_at>=v_previous_start
  ),
  systems_metrics as (
    select
      count(*) filter(where status='active')::int active,
      count(*) filter(where status='needs_attention')::int needs_attention
    from public.organization_systems
    where organization_id=p_organization_id
  ),
  stage_distribution as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'stageId',s.id,
      'key',s.key,
      'name',s.name,
      'category',s.category,
      'count',coalesce(x.customer_count,0)
    ) order by s.position,s.name),'[]'::jsonb) value
    from public.organization_customer_stages s
    left join (
      select current_stage_id,count(*)::int customer_count
      from public.crm_customers
      where organization_id=p_organization_id and current_stage_id is not null
      group by current_stage_id
    ) x on x.current_stage_id=s.id
    where s.organization_id=p_organization_id and s.status='active'
  ),
  channel_distribution as (
    select coalesce(jsonb_agg(jsonb_build_object('channel',channel,'count',cnt) order by cnt desc),'[]'::jsonb) value
    from (
      select channel,count(*)::int cnt
      from public.crm_conversations
      where organization_id=p_organization_id and created_at>=v_start
      group by channel
    ) q
  ),
  stage_transitions as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'stageId',s.id,'name',s.name,'count',q.cnt
    ) order by q.cnt desc,s.name),'[]'::jsonb) value
    from (
      select to_stage_id,count(*)::int cnt
      from public.customer_stage_history
      where organization_id=p_organization_id and changed_at>=v_start
      group by to_stage_id
    ) q
    join public.organization_customer_stages s on s.organization_id=p_organization_id and s.id=q.to_stage_id
  )
  select jsonb_build_object(
    'organizationId',p_organization_id,
    'generatedAt',v_now,
    'periodDays',v_days,
    'periodStart',v_start,
    'previousPeriodStart',v_previous_start,
    'customers',jsonb_build_object(
      'total',cm.total,'currentNew',cm.current_new,'previousNew',cm.previous_new
    ),
    'conversations',jsonb_build_object(
      'current',cv.current_count,'previous',cv.previous_count,'uniqueCustomers',cv.current_customers,
      'aiHandledRate',case when cv.current_count=0 then null else
        round(greatest(0,least(100,((cv.current_count-hm.current_conversations)::numeric/cv.current_count)*100)),1) end
    ),
    'messages',jsonb_build_object(
      'current',mm.current_count,'previous',mm.previous_count,'ai',mm.ai_messages,
      'human',mm.human_messages,'customer',mm.customer_messages
    ),
    'handoffs',jsonb_build_object(
      'current',hm.current_count,'previous',hm.previous_count,'resolved',hm.resolved,'assigned',hm.assigned,
      'slaBreached',hm.sla_breached,
      'slaMetRate',case when hm.current_count=0 then null else round(((hm.current_count-hm.sla_breached)::numeric/hm.current_count)*100,1) end,
      'avgClaimMinutes',hm.avg_claim_minutes,'avgResolutionMinutes',hm.avg_resolution_minutes,
      'followUpRequired',hm.follow_up_required,'followUpCompleted',hm.follow_up_completed
    ),
    'appointments',jsonb_build_object(
      'current',am.current_count,'previous',am.previous_count,'confirmed',am.confirmed,'cancelled',am.cancelled,'failed',am.failed,
      'confirmationRate',case when am.current_count=0 then null else round((am.confirmed::numeric/am.current_count)*100,1) end
    ),
    'runtime',jsonb_build_object(
      'current',rm.current_count,'previous',rm.previous_count,'succeeded',rm.succeeded,'failed',rm.failed,
      'successRate',case when (rm.succeeded+rm.failed)=0 then null else round((rm.succeeded::numeric/(rm.succeeded+rm.failed))*100,1) end,
      'avgLatencyMs',rm.avg_latency_ms,'costMinor',rm.cost_minor,
      'toolCalls',tm.current_count,'toolSucceeded',tm.succeeded,'toolFailed',tm.failed
    ),
    'whatsapp',jsonb_build_object(
      'current',wm.current_count,'previous',wm.previous_count,'successful',wm.successful,'failed',wm.failed,'read',wm.read,
      'deliverySuccessRate',case when wm.current_count=0 then null else round((wm.successful::numeric/wm.current_count)*100,1) end
    ),
    'systems',jsonb_build_object('active',sm.active,'needsAttention',sm.needs_attention),
    'stageDistribution',sd.value,
    'channelDistribution',cd.value,
    'stageTransitions',st.value
  )
  into v_result
  from customer_metrics cm,conversation_metrics cv,message_metrics mm,handoff_metrics hm,
       appointment_metrics am,runtime_metrics rm,tool_metrics tm,whatsapp_metrics wm,systems_metrics sm,
       stage_distribution sd,channel_distribution cd,stage_transitions st;

  return v_result;
end $$;

revoke all on function public.get_tenant_operational_analytics(uuid,integer)
from public,anon,authenticated;
grant execute on function public.get_tenant_operational_analytics(uuid,integer)
to service_role;
