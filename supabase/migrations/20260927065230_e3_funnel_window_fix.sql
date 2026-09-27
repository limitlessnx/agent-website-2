CREATE OR REPLACE FUNCTION public.get_tenant_funnel_analytics(p_organization_id uuid, p_period_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  stage_steps as (
    select
      id,key,name,category,position,is_terminal,reached,
      lag(reached) over(order by position,name) previous_reached
    from stage_counts
  ),
  funnel as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'stageId',id,'key',key,'name',name,'category',category,'position',position,'terminal',is_terminal,
      'reached',reached,
      'previousReached',previous_reached,
      'stepConversionRate',case
        when previous_reached is null or previous_reached=0 then null
        else round((reached::numeric/previous_reached)*100,1)
      end
    ) order by position,name),'[]'::jsonb) value
    from stage_steps
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
end $function$
;
revoke all on function public.get_tenant_funnel_analytics(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_tenant_funnel_analytics(uuid,integer) to service_role;
