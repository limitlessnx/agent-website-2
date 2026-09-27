update public.system_event_route_templates rt
set dispatch_mode='agent_runtime',
    configuration=coalesce(rt.configuration,'{}'::jsonb) || '{"adapter":"channel_reply"}'::jsonb,
    updated_at=now()
from public.system_catalog src, public.system_catalog dst
where rt.source_system_catalog_id=src.id
  and rt.target_system_catalog_id=dst.id
  and rt.event_type in (
    'appointment.email_required',
    'appointment.slot_unavailable',
    'appointment.booked',
    'appointment.rescheduled',
    'appointment.cancelled',
    'reminder.scheduled'
  )
  and dst.slug in ('whatsapp-agent','email-automation');

update public.system_event_route_templates rt
set dispatch_mode='agent_runtime',
    updated_at=now()
from public.system_catalog dst
where rt.target_system_catalog_id=dst.id
  and rt.event_type='appointment.calendar_required'
  and dst.slug='support-agent';

update public.system_event_route_templates rt
set dispatch_mode='agent_runtime',
    updated_at=now()
from public.system_catalog dst
where rt.target_system_catalog_id=dst.id
  and rt.event_type='appointment.email_required'
  and dst.slug='support-agent';

do $$
declare v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.sync_organization_system_event_routes(v_org.id);
  end loop;
end $$;
