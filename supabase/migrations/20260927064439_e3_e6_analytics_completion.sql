create table if not exists public.organization_business_value_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  currency text,
  human_hourly_value numeric,
  minutes_per_ai_handled_conversation numeric,
  minutes_per_follow_up numeric,
  minutes_per_appointment numeric,
  minutes_per_handoff_triage numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_business_value_settings enable row level security;
revoke all on public.organization_business_value_settings from anon,authenticated;
grant select on public.organization_business_value_settings to authenticated;
grant all on public.organization_business_value_settings to service_role;

create policy organization_business_value_settings_select
on public.organization_business_value_settings for select to authenticated
using(
  public.has_organization_permission(organization_id,'analytics.view')
  or public.has_organization_permission(organization_id,'organization.manage')
);

create index if not exists crm_leads_org_created_idx
  on public.crm_leads(organization_id,created_at desc);
create index if not exists crm_leads_org_source_created_idx
  on public.crm_leads(organization_id,source,created_at desc);
create index if not exists dashboard_notifications_source_org_idx
  on public.dashboard_notifications(source,organization_id,resolved_at);

create or replace function public.get_tenant_funnel_analytics(
  p_organization_id uuid,
  p_period_days integer default 30
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_period_days,30),365));
  v_start timestamptz:=now()-make_interval(days=>greatest(1,least(coalesce(p_period_days,30),365)));
  v_result jsonb;
begin
  with
  cohort as (
    select id
    from public.crm_customers
    where organization_id=p_organization_id and created_at>=v_start
  ),
  reached as (
    select c.id customer_id,s.id stage_id,s.position
    from cohort c
    join public.crm_customers cc on cc.id=c.id and cc.organization_id=p_organization_id
    join public.organization_customer_stages s
      on s.organization_id=p_organization_id
     and s.status='active'
     and (
       s.id=cc.current_stage_id
       or exists(
         select 1 from public.customer_stage_history h
         where h.organization_id=p_organization_id
           and h.customer_id=c.id
           and h.to_stage_id=s.id
           and h.changed_at>=v_start
       )
     )
  ),
  stage_counts as (
    select s.id,s.key,s.name,s.category,s.position,s.is_terminal,
      count(distinct r.customer_id)::int reached
    from public.organization_customer_stages s
    left join reached r on r.stage_id=s.id
    where s.organization_id=p_organization_id and s.status='active'
    group by s.id,s.key,s.name,s.category,s.position,s.is_terminal
  ),
  funnel as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'stageId',id,'key',key,'name',name,'category',category,'position',position,'terminal',is_terminal,
      'reached',reached,
      'previousReached',lag(reached) over(order by position,name),
      'stepConversionRate',case
        when lag(reached) over(order by position,name) is null then null
        when lag(reached) over(order by position,name)=0 then null
        else round((reached::numeric/lag(reached) over(order by position,name))*100,1)
      end
    ) order by position,name),'[]'::jsonb) value
    from stage_counts
  ),
  source_breakdown as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'source',source,
      'leads',leads,
      'won',won,
      'wonRate',case when leads=0 then null else round((won::numeric/leads)*100,1) end
    ) order by leads desc,source),'[]'::jsonb) value
    from (
      select coalesce(nullif(trim(l.source),''),'unknown') source,
        count(distinct l.customer_id)::int leads,
        count(distinct l.customer_id) filter(where exists(
          select 1
          from public.crm_customers c
          join public.organization_customer_stages s on s.id=c.current_stage_id and s.organization_id=c.organization_id
          where c.organization_id=p_organization_id
            and c.id=l.customer_id
            and s.category='won'
        ))::int won
      from public.crm_leads l
      where l.organization_id=p_organization_id and l.created_at>=v_start
      group by coalesce(nullif(trim(l.source),''),'unknown')
    ) q
  ),
  channel_breakdown as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'channel',channel,
      'customers',customers,
      'won',won,
      'wonRate',case when customers=0 then null else round((won::numeric/customers)*100,1) end
    ) order by customers desc,channel),'[]'::jsonb) value
    from (
      select first_channel channel,count(*)::int customers,
        count(*) filter(where current_category='won')::int won
      from (
        select c.id,
          coalesce((
            select cc.channel from public.crm_conversations cc
            where cc.organization_id=p_organization_id and cc.customer_id=c.id
            order by cc.created_at asc limit 1
          ),'unknown') first_channel,
          s.category current_category
        from public.crm_customers c
        left join public.organization_customer_stages s
          on s.organization_id=c.organization_id and s.id=c.current_stage_id
        where c.organization_id=p_organization_id and c.created_at>=v_start
      ) z
      group by first_channel
    ) q
  ),
  handoff_comparison as (
    select jsonb_build_object(
      'withHandoff',jsonb_build_object(
        'customers',count(*) filter(where had_handoff)::int,
        'won',count(*) filter(where had_handoff and stage_category='won')::int,
        'wonRate',case when count(*) filter(where had_handoff)=0 then null else
          round((count(*) filter(where had_handoff and stage_category='won')::numeric/
                 count(*) filter(where had_handoff))*100,1) end
      ),
      'withoutHandoff',jsonb_build_object(
        'customers',count(*) filter(where not had_handoff)::int,
        'won',count(*) filter(where not had_handoff and stage_category='won')::int,
        'wonRate',case when count(*) filter(where not had_handoff)=0 then null else
          round((count(*) filter(where not had_handoff and stage_category='won')::numeric/
                 count(*) filter(where not had_handoff))*100,1) end
      )
    ) value
    from (
      select c.id,
        exists(
          select 1 from public.human_handoffs h
          where h.organization_id=p_organization_id and h.customer_id=c.id and h.created_at>=v_start
        ) had_handoff,
        s.category stage_category
      from public.crm_customers c
      left join public.organization_customer_stages s
        on s.organization_id=c.organization_id and s.id=c.current_stage_id
      where c.organization_id=p_organization_id and c.created_at>=v_start
    ) q
  ),
  appointment_comparison as (
    select jsonb_build_object(
      'withAppointment',jsonb_build_object(
        'customers',count(*) filter(where had_appointment)::int,
        'won',count(*) filter(where had_appointment and stage_category='won')::int,
        'wonRate',case when count(*) filter(where had_appointment)=0 then null else
          round((count(*) filter(where had_appointment and stage_category='won')::numeric/
                 count(*) filter(where had_appointment))*100,1) end
      ),
      'withoutAppointment',jsonb_build_object(
        'customers',count(*) filter(where not had_appointment)::int,
        'won',count(*) filter(where not had_appointment and stage_category='won')::int,
        'wonRate',case when count(*) filter(where not had_appointment)=0 then null else
          round((count(*) filter(where not had_appointment and stage_category='won')::numeric/
                 count(*) filter(where not had_appointment))*100,1) end
      )
    ) value
    from (
      select c.id,
        exists(
          select 1 from public.appointments a
          where a.organization_id=p_organization_id and a.customer_id=c.id
            and a.created_at>=v_start and a.status in ('confirmed','rescheduled')
        ) had_appointment,
        s.category stage_category
      from public.crm_customers c
      left join public.organization_customer_stages s
        on s.organization_id=c.organization_id and s.id=c.current_stage_id
      where c.organization_id=p_organization_id and c.created_at>=v_start
    ) q
  ),
  totals as (
    select
      count(*)::int cohort_customers,
      count(*) filter(where s.category='won')::int won,
      count(*) filter(where s.category='lost')::int lost,
      count(*) filter(where s.category='follow_up')::int follow_up
    from public.crm_customers c
    left join public.organization_customer_stages s
      on s.organization_id=c.organization_id and s.id=c.current_stage_id
    where c.organization_id=p_organization_id and c.created_at>=v_start
  )
  select jsonb_build_object(
    'organizationId',p_organization_id,
    'periodDays',v_days,
    'periodStart',v_start,
    'cohort',jsonb_build_object(
      'customers',t.cohort_customers,
      'won',t.won,
      'lost',t.lost,
      'followUp',t.follow_up,
      'wonRate',case when t.cohort_customers=0 then null else round((t.won::numeric/t.cohort_customers)*100,1) end
    ),
    'funnel',f.value,
    'sources',sb.value,
    'channels',cb.value,
    'handoffComparison',hc.value,
    'appointmentComparison',ac.value
  )
  into v_result
  from totals t,funnel f,source_breakdown sb,channel_breakdown cb,handoff_comparison hc,appointment_comparison ac;

  return v_result;
end $$;

revoke all on function public.get_tenant_funnel_analytics(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_tenant_funnel_analytics(uuid,integer) to service_role;

create or replace function public.get_tenant_business_value_analytics(
  p_organization_id uuid,
  p_period_days integer default 30
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_period_days,30),365));
  v_start timestamptz:=now()-make_interval(days=>greatest(1,least(coalesce(p_period_days,30),365)));
  v_settings public.organization_business_value_settings%rowtype;
  v_ai_handled integer;
  v_followups integer;
  v_appointments integer;
  v_handoffs integer;
  v_minutes numeric;
  v_money numeric;
begin
  select * into v_settings
  from public.organization_business_value_settings
  where organization_id=p_organization_id;

  select count(*)::int into v_ai_handled
  from public.crm_conversations c
  where c.organization_id=p_organization_id and c.created_at>=v_start
    and not exists(
      select 1 from public.human_handoffs h
      where h.organization_id=p_organization_id and h.conversation_id=c.id and h.created_at>=v_start
    );

  select count(*)::int into v_followups
  from public.crm_tasks
  where organization_id=p_organization_id and task_type='handoff_follow_up'
    and status='completed' and completed_at>=v_start;

  select count(*)::int into v_appointments
  from public.appointments
  where organization_id=p_organization_id and created_at>=v_start
    and status in ('confirmed','rescheduled');

  select count(*)::int into v_handoffs
  from public.human_handoffs
  where organization_id=p_organization_id and created_at>=v_start
    and assigned_membership_id is not null;

  if coalesce(v_settings.enabled,false) then
    v_minutes :=
      v_ai_handled*coalesce(v_settings.minutes_per_ai_handled_conversation,0)
      + v_followups*coalesce(v_settings.minutes_per_follow_up,0)
      + v_appointments*coalesce(v_settings.minutes_per_appointment,0)
      + v_handoffs*coalesce(v_settings.minutes_per_handoff_triage,0);
    if v_settings.human_hourly_value is not null then
      v_money:=round((v_minutes/60.0)*v_settings.human_hourly_value,2);
    end if;
  end if;

  return jsonb_build_object(
    'organizationId',p_organization_id,
    'periodDays',v_days,
    'periodStart',v_start,
    'configured',coalesce(v_settings.enabled,false),
    'currency',v_settings.currency,
    'automationVolume',jsonb_build_object(
      'aiHandledConversations',v_ai_handled,
      'completedFollowUps',v_followups,
      'confirmedAppointments',v_appointments,
      'assignedHandoffs',v_handoffs
    ),
    'assumptions',case when coalesce(v_settings.enabled,false) then jsonb_build_object(
      'humanHourlyValue',v_settings.human_hourly_value,
      'minutesPerAiHandledConversation',v_settings.minutes_per_ai_handled_conversation,
      'minutesPerFollowUp',v_settings.minutes_per_follow_up,
      'minutesPerAppointment',v_settings.minutes_per_appointment,
      'minutesPerHandoffTriage',v_settings.minutes_per_handoff_triage
    ) else null end,
    'estimatedMinutesSaved',case when coalesce(v_settings.enabled,false) then v_minutes else null end,
    'estimatedHoursSaved',case when coalesce(v_settings.enabled,false) then round(v_minutes/60.0,1) else null end,
    'estimatedValue',case when coalesce(v_settings.enabled,false) then v_money else null end
  );
end $$;

revoke all on function public.get_tenant_business_value_analytics(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_tenant_business_value_analytics(uuid,integer) to service_role;

create or replace function public.get_platform_analytics_health(
  p_period_days integer default 7
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_period_days,7),90));
  v_start timestamptz:=now()-make_interval(days=>greatest(1,least(coalesce(p_period_days,7),90)));
  v_result jsonb;
begin
  with per_org as (
    select o.id organization_id,o.name,o.slug,o.status,
      (select count(*) from public.organization_systems os where os.organization_id=o.id and os.status='active')::int active_systems,
      (select count(*) from public.organization_systems os where os.organization_id=o.id and os.status='needs_attention')::int systems_needing_attention,
      (select count(*) from public.runtime_executions r where r.organization_id=o.id and r.created_at>=v_start)::int executions,
      (select count(*) from public.runtime_executions r where r.organization_id=o.id and r.created_at>=v_start and r.status='failed')::int runtime_failures,
      (select count(*) from public.domain_events e where e.organization_id=o.id and e.created_at>=v_start and e.status='failed')::int event_failures,
      (select count(*) from public.human_handoffs h where h.organization_id=o.id and h.created_at>=v_start
        and h.sla_due_at is not null and coalesce(h.resolved_at,h.closed_at,now())>h.sla_due_at)::int sla_breaches,
      (select count(*) from public.whatsapp_delivery_attempts w where w.organization_id=o.id::text and w.created_at>=v_start)::int whatsapp_attempts,
      (select count(*) from public.whatsapp_delivery_attempts w where w.organization_id=o.id::text and w.created_at>=v_start and w.status='failed')::int whatsapp_failures
    from public.organizations o
    where o.status='active'
  ),
  rows as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'organizationId',organization_id,'name',name,'slug',slug,'status',status,
      'activeSystems',active_systems,'systemsNeedingAttention',systems_needing_attention,
      'executions',executions,'runtimeFailures',runtime_failures,
      'runtimeFailureRate',case when executions=0 then null else round((runtime_failures::numeric/executions)*100,1) end,
      'eventFailures',event_failures,'slaBreaches',sla_breaches,
      'whatsappAttempts',whatsapp_attempts,'whatsappFailures',whatsapp_failures,
      'whatsappFailureRate',case when whatsapp_attempts=0 then null else round((whatsapp_failures::numeric/whatsapp_attempts)*100,1) end,
      'health',case
        when systems_needing_attention>0 or event_failures>=3 or sla_breaches>=3
          or (executions>=5 and runtime_failures::numeric/executions>=0.25)
          or (whatsapp_attempts>=5 and whatsapp_failures::numeric/whatsapp_attempts>=0.25)
          then 'critical'
        when event_failures>0 or sla_breaches>0 or runtime_failures>0 or whatsapp_failures>0 then 'attention'
        else 'healthy'
      end
    ) order by
      case
        when systems_needing_attention>0 or event_failures>=3 or sla_breaches>=3
          or (executions>=5 and runtime_failures::numeric/executions>=0.25)
          or (whatsapp_attempts>=5 and whatsapp_failures::numeric/whatsapp_attempts>=0.25)
          then 0
        when event_failures>0 or sla_breaches>0 or runtime_failures>0 or whatsapp_failures>0 then 1
        else 2
      end,name),'[]'::jsonb) value
    from per_org
  )
  select jsonb_build_object(
    'periodDays',v_days,'periodStart',v_start,
    'organizations',(select count(*) from public.organizations where status='active'),
    'critical',(select count(*) from per_org where
      systems_needing_attention>0 or event_failures>=3 or sla_breaches>=3
      or (executions>=5 and runtime_failures::numeric/executions>=0.25)
      or (whatsapp_attempts>=5 and whatsapp_failures::numeric/whatsapp_attempts>=0.25)),
    'attention',(select count(*) from per_org where
      not (systems_needing_attention>0 or event_failures>=3 or sla_breaches>=3
      or (executions>=5 and runtime_failures::numeric/executions>=0.25)
      or (whatsapp_attempts>=5 and whatsapp_failures::numeric/whatsapp_attempts>=0.25))
      and (event_failures>0 or sla_breaches>0 or runtime_failures>0 or whatsapp_failures>0)),
    'tenants',rows.value
  )
  into v_result
  from rows;
  return v_result;
end $$;

revoke all on function public.get_platform_analytics_health(integer) from public,anon,authenticated;
grant execute on function public.get_platform_analytics_health(integer) to service_role;

create or replace function public.scan_analytics_anomalies()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r record;
  v_now timestamptz:=now();
  v_runtime_24 integer;
  v_runtime_fail_24 integer;
  v_runtime_prev integer;
  v_runtime_fail_prev integer;
  v_wa_24 integer;
  v_wa_fail_24 integer;
  v_wa_prev integer;
  v_wa_fail_prev integer;
  v_handoff_24 integer;
  v_handoff_prev integer;
  v_sla_24 integer;
  v_created integer:=0;
  v_resolved integer:=0;
  v_key text;
begin
  for r in select id,name from public.organizations where status='active' loop
    select count(*)::int,count(*) filter(where status='failed')::int
      into v_runtime_24,v_runtime_fail_24
    from public.runtime_executions
    where organization_id=r.id and created_at>=v_now-interval '24 hours';

    select count(*)::int,count(*) filter(where status='failed')::int
      into v_runtime_prev,v_runtime_fail_prev
    from public.runtime_executions
    where organization_id=r.id and created_at>=v_now-interval '8 days' and created_at<v_now-interval '24 hours';

    select count(*)::int,count(*) filter(where status='failed')::int
      into v_wa_24,v_wa_fail_24
    from public.whatsapp_delivery_attempts
    where organization_id=r.id::text and created_at>=v_now-interval '24 hours';

    select count(*)::int,count(*) filter(where status='failed')::int
      into v_wa_prev,v_wa_fail_prev
    from public.whatsapp_delivery_attempts
    where organization_id=r.id::text and created_at>=v_now-interval '8 days' and created_at<v_now-interval '24 hours';

    select count(*)::int into v_handoff_24
    from public.human_handoffs
    where organization_id=r.id and created_at>=v_now-interval '24 hours';

    select count(*)::int into v_handoff_prev
    from public.human_handoffs
    where organization_id=r.id and created_at>=v_now-interval '8 days' and created_at<v_now-interval '24 hours';

    select count(*)::int into v_sla_24
    from public.human_handoffs
    where organization_id=r.id and created_at>=v_now-interval '24 hours'
      and sla_due_at is not null and coalesce(resolved_at,closed_at,v_now)>sla_due_at;

    v_key:='analytics:'||r.id||':runtime_failure_spike';
    if v_runtime_24>=5
       and (v_runtime_fail_24::numeric/v_runtime_24)>=0.20
       and (
         v_runtime_prev<5
         or (v_runtime_fail_24::numeric/v_runtime_24) >
            greatest(0.10,(v_runtime_fail_prev::numeric/nullif(v_runtime_prev,0))*1.5)
       ) then
      insert into public.dashboard_notifications(
        event_key,organization_id,audience,category,severity,title,message,action_label,action_href,source,persistent,metadata,last_seen_at,resolved_at,updated_at
      ) values(
        v_key,r.id,'both','analytics_anomaly','warning','AI runtime failure rate increased',
        'Runtime failures are materially above the recent baseline.','Review analytics','/portal/analytics','analytics_anomaly',false,
        jsonb_build_object('metric','runtime_failure_rate','currentExecutions',v_runtime_24,'currentFailures',v_runtime_fail_24,'baselineExecutions',v_runtime_prev,'baselineFailures',v_runtime_fail_prev),
        v_now,null,v_now
      )
      on conflict(event_key) do update set last_seen_at=excluded.last_seen_at,resolved_at=null,updated_at=v_now,metadata=excluded.metadata,message=excluded.message;
      v_created:=v_created+1;
    else
      update public.dashboard_notifications set resolved_at=v_now,updated_at=v_now,persistent=false
      where event_key=v_key and resolved_at is null;
      if found then v_resolved:=v_resolved+1; end if;
    end if;

    v_key:='analytics:'||r.id||':whatsapp_failure_spike';
    if v_wa_24>=5
       and (v_wa_fail_24::numeric/v_wa_24)>=0.20
       and (
         v_wa_prev<5
         or (v_wa_fail_24::numeric/v_wa_24) >
            greatest(0.10,(v_wa_fail_prev::numeric/nullif(v_wa_prev,0))*1.5)
       ) then
      insert into public.dashboard_notifications(
        event_key,organization_id,audience,category,severity,title,message,action_label,action_href,source,persistent,metadata,last_seen_at,resolved_at,updated_at
      ) values(
        v_key,r.id,'both','analytics_anomaly','warning','WhatsApp delivery failures increased',
        'WhatsApp failures are materially above the recent baseline.','Review analytics','/portal/analytics','analytics_anomaly',false,
        jsonb_build_object('metric','whatsapp_failure_rate','currentAttempts',v_wa_24,'currentFailures',v_wa_fail_24,'baselineAttempts',v_wa_prev,'baselineFailures',v_wa_fail_prev),
        v_now,null,v_now
      )
      on conflict(event_key) do update set last_seen_at=excluded.last_seen_at,resolved_at=null,updated_at=v_now,metadata=excluded.metadata,message=excluded.message;
      v_created:=v_created+1;
    else
      update public.dashboard_notifications set resolved_at=v_now,updated_at=v_now,persistent=false
      where event_key=v_key and resolved_at is null;
      if found then v_resolved:=v_resolved+1; end if;
    end if;

    v_key:='analytics:'||r.id||':handoff_spike';
    if v_handoff_24>=3 and v_handoff_24 > greatest(3,ceil((v_handoff_prev/7.0)*2.0)) then
      insert into public.dashboard_notifications(
        event_key,organization_id,audience,category,severity,title,message,action_label,action_href,source,persistent,metadata,last_seen_at,resolved_at,updated_at
      ) values(
        v_key,r.id,'both','analytics_anomaly','warning','Human handoffs increased',
        'Human handoff volume is materially above the recent daily baseline.','Review handoffs','/portal/notifications','analytics_anomaly',false,
        jsonb_build_object('metric','handoff_volume','current24h',v_handoff_24,'baseline7d',v_handoff_prev),
        v_now,null,v_now
      )
      on conflict(event_key) do update set last_seen_at=excluded.last_seen_at,resolved_at=null,updated_at=v_now,metadata=excluded.metadata,message=excluded.message;
      v_created:=v_created+1;
    else
      update public.dashboard_notifications set resolved_at=v_now,updated_at=v_now,persistent=false
      where event_key=v_key and resolved_at is null;
      if found then v_resolved:=v_resolved+1; end if;
    end if;

    v_key:='analytics:'||r.id||':sla_breach';
    if v_sla_24>0 then
      insert into public.dashboard_notifications(
        event_key,organization_id,audience,category,severity,title,message,action_label,action_href,source,persistent,metadata,last_seen_at,resolved_at,updated_at
      ) values(
        v_key,r.id,'both','analytics_anomaly',
        case when v_sla_24>=3 then 'critical' else 'warning' end,
        'Human handoff SLA breached',
        v_sla_24||' handoff SLA breach'||case when v_sla_24=1 then '' else 'es' end||' detected in the last 24 hours.',
        'Review handoffs','/portal/notifications','analytics_anomaly',v_sla_24>=3,
        jsonb_build_object('metric','sla_breaches','current24h',v_sla_24),
        v_now,null,v_now
      )
      on conflict(event_key) do update set last_seen_at=excluded.last_seen_at,resolved_at=null,updated_at=v_now,
        severity=excluded.severity,persistent=excluded.persistent,metadata=excluded.metadata,message=excluded.message;
      v_created:=v_created+1;
    else
      update public.dashboard_notifications set resolved_at=v_now,updated_at=v_now,persistent=false
      where event_key=v_key and resolved_at is null;
      if found then v_resolved:=v_resolved+1; end if;
    end if;
  end loop;

  return jsonb_build_object('activeOrRefreshed',v_created,'resolved',v_resolved,'scannedAt',v_now);
end $$;

revoke all on function public.scan_analytics_anomalies() from public,anon,authenticated;
grant execute on function public.scan_analytics_anomalies() to service_role;
