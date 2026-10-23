begin;

insert into public.whatsapp_template_configs
  (organization_id, purpose, template_name, language_code, variable_keys, status, metadata)
select
  o.id::text,
  'appointment_reminder',
  'appointment_reminder',
  'en',
  '["customer_name","business_name","service_name","appointment_date","appointment_time","booking_reference"]'::jsonb,
  'active',
  jsonb_build_object(
    'body', E'Hello {{1}}, this is a friendly reminder of your upcoming appointment with {{2}}.\n\nService: {{3}}\nDate: {{4}}\nTime: {{5}}\nBooking reference: {{6}}\n\nIf you need to reschedule or require assistance, please reply to this message.',
    'category', 'marketing',
    'approval_source', 'user_supplied_whatsapp_manager_screenshot',
    'provider_family', 'meta',
    'template_name_note', 'Preserve exact Meta-approved spelling and casing: appointment_reminder',
    'template_name_exact', true,
    'variable_mapping_version', 1
  )
from public.organizations o
where o.slug = 'xposure'
on conflict (organization_id, purpose) do update
set template_name = excluded.template_name,
    language_code = excluded.language_code,
    variable_keys = excluded.variable_keys,
    status = excluded.status,
    metadata = excluded.metadata,
    updated_at = now();

commit;
