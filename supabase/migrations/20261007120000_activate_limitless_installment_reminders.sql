begin;

-- Activate the Meta-approved Limitless Realty installment reminder template.
-- The production scheduler remains the existing 5-minute Maia safety-net.
insert into public.whatsapp_template_configs
  (organization_id, purpose, template_name, language_code, variable_keys, status, metadata)
values
  (
    'b15f21b4-5697-4d21-9421-8a34eae3476d',
    'installment_payment_reminder',
    'limitless_realty_reminder',
    'en_US',
    '["client_name","property_title","outstanding_balance"]'::jsonb,
    'active',
    jsonb_build_object(
      'agent', 'maia',
      'channel', 'whatsapp',
      'provider_status', 'approved',
      'organization_slug', 'limitless-realty',
      'approved_template_scope', 'installment_payment_reminder'
    )
  )
on conflict (organization_id, purpose)
do update set
  template_name = excluded.template_name,
  language_code = excluded.language_code,
  variable_keys = excluded.variable_keys,
  status = excluded.status,
  metadata = public.whatsapp_template_configs.metadata
    || excluded.metadata,
  updated_at = now();

commit;
