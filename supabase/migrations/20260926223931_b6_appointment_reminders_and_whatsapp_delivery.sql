update public.system_event_route_templates rt
set dispatch_mode='workflow_adapter',
    configuration=jsonb_build_object('adapter','channel_reply'),
    updated_at=now()
from public.system_catalog src, public.system_catalog dst
where rt.source_system_catalog_id=src.id
  and rt.target_system_catalog_id=dst.id
  and dst.slug='whatsapp-agent'
  and rt.event_type in (
    'appointment.email_required',
    'appointment.slot_unavailable',
    'appointment.booked',
    'appointment.rescheduled',
    'appointment.cancelled',
    'reminder.scheduled'
  );

create index if not exists crm_tasks_appointment_reminder_due_idx
  on public.crm_tasks(organization_id,due_at)
  where task_type='appointment_reminder' and status='scheduled';

do $$
declare v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.sync_organization_system_event_routes(v_org.id);
  end loop;
end $$;
