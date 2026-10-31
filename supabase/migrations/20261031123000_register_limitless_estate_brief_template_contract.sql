begin;

insert into public.whatsapp_template_configs (
  organization_id,
  purpose,
  template_name,
  language_code,
  variable_keys,
  status,
  metadata,
  updated_at
)
values (
  'b15f21b4-5697-4d21-9421-8a34eae3476d',
  'estate_brief_update',
  'estate_brief_update',
  'en_US',
  '["customer_name","property_name","property_location","property_price","selling_point"]'::jsonb,
  'active',
  jsonb_build_object(
    'agent', 'maia',
    'channel', 'whatsapp',
    'provider_status', 'approved',
    'approved_variable_order', jsonb_build_array('customer_name','property_name','property_location','property_price','selling_point'),
    'header_image_required', true,
    'approval_source', 'user_confirmed_meta_approval',
    'organization_slug', 'limitless-realty'
  ),
  now()
)
on conflict (organization_id, purpose)
do update set
  template_name = excluded.template_name,
  language_code = excluded.language_code,
  variable_keys = excluded.variable_keys,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

commit;
