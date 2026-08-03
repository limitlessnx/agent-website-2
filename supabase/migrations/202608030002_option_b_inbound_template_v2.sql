begin;

with template_seed (slug, version, source_workflow_id, source_workflow_name, cadence_mode, route_hints) as (
  values
    (
      'lead-intake-router',
      2,
      'pMB1MwFWPIJALBXW',
      'TEMPLATE - Fluxknight - Lead Intake Router - v2',
      'event_driven',
      jsonb_build_array('qualify_lead', 'start_follow_up', 'book_or_update_appointment', 'handoff_if_urgent')
    ),
    (
      'whatsapp-lead-follow-up',
      2,
      'y8a8H4gNdF8Z2rtI',
      'TEMPLATE - Fluxknight - WhatsApp Lead Follow-up - v2',
      'configurable_follow_up',
      jsonb_build_array('send_whatsapp_message', 'pause_on_reply', 'handoff_hot_lead', 'mark_sequence_complete')
    ),
    (
      'email-outreach',
      2,
      'PyDKfA9dFw7uFkW0',
      'TEMPLATE - Fluxknight - Email Outreach - v2',
      'configurable_follow_up',
      jsonb_build_array('send_email', 'pause_on_reply', 'handoff_high_intent', 'mark_campaign_complete')
    ),
    (
      'appointment-reminders',
      2,
      'uIsKJ07w4hooR7ga',
      'TEMPLATE - Fluxknight - Appointment Reminders - v2',
      'appointment_relative',
      jsonb_build_array('send_reminder', 'confirm_attendance', 'reschedule', 'handoff_no_show')
    ),
    (
      'lead-qualification',
      2,
      'PNlwSOqKBhJhn7d7',
      'TEMPLATE - Fluxknight - Lead Qualification - v2',
      'event_driven',
      jsonb_build_array('score_lead', 'request_missing_info', 'start_follow_up', 'handoff_qualified_lead')
    ),
    (
      'customer-support-handoff',
      2,
      'GaKOHT14YyaoGfCX',
      'TEMPLATE - Fluxknight - Customer Support Handoff - v2',
      'support_sla',
      jsonb_build_array('classify_issue', 'respond_or_escalate', 'handoff_urgent_case', 'schedule_check_in')
    )
)
insert into public.automation_template_versions (
  automation_template_id,
  version,
  source_n8n_workflow_id,
  source_n8n_workflow_name,
  configuration_defaults,
  validation_notes,
  status,
  approved_at
)
select
  template.id,
  seed.version,
  seed.source_workflow_id,
  seed.source_workflow_name,
  jsonb_build_object(
    'timezone', 'Africa/Lagos',
    'template_source', 'n8n',
    'provisioning_model', 'dedicated_clone',
    'inbound_ready', true,
    'cadence_mode', seed.cadence_mode,
    'route_hints', seed.route_hints
  ),
  'Approved v2 source template for inbound-ready Fluxknight tenant workflow cloning.',
  'approved',
  now()
from template_seed seed
join public.automation_templates template on template.slug = seed.slug
on conflict (automation_template_id, version) do update set
  source_n8n_workflow_id = excluded.source_n8n_workflow_id,
  source_n8n_workflow_name = excluded.source_n8n_workflow_name,
  configuration_defaults = excluded.configuration_defaults,
  validation_notes = excluded.validation_notes,
  status = excluded.status,
  approved_at = coalesce(public.automation_template_versions.approved_at, excluded.approved_at),
  updated_at = now();

commit;
