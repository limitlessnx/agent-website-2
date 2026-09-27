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
  where c.organization_id=p_organization_id
    and c.created_at>=v_start
    and exists(
      select 1 from public.crm_messages m
      where m.organization_id=p_organization_id
        and m.conversation_id=c.id
        and m.sender_type='agent'
    )
    and not exists(
      select 1 from public.crm_messages m
      where m.organization_id=p_organization_id
        and m.conversation_id=c.id
        and m.sender_type='human'
    )
    and not exists(
      select 1 from public.human_handoffs h
      where h.organization_id=p_organization_id
        and h.conversation_id=c.id
        and h.created_at>=v_start
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
