CREATE OR REPLACE FUNCTION public.scan_analytics_anomalies()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        v_key,r.id,'customer','analytics_anomaly','warning','AI runtime failure rate increased',
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
        v_key,r.id,'customer','analytics_anomaly','warning','WhatsApp delivery failures increased',
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
        v_key,r.id,'customer','analytics_anomaly','warning','Human handoffs increased',
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
        v_key,r.id,'customer','analytics_anomaly',
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
end $function$
;
revoke all on function public.scan_analytics_anomalies() from public,anon,authenticated;
grant execute on function public.scan_analytics_anomalies() to service_role;
