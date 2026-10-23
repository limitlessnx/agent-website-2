begin;

insert into public.whatsapp_template_configs
  (organization_id, purpose, template_name, language_code, variable_keys, status, metadata)
select
  o.id::text,
  'customer_follow_up',
  'custoemr_follow_ip',
  'en',
  '["customer_name","enquiry_type","business_name"]'::jsonb,
  'active',
  jsonb_build_object(
    'body', E'Hello {{1}}, we''re following up on your {{2}} enquiry with {{3}}.\n\nIf you still need assistance, please reply to this message and our team will be happy to help.',
    'category', 'utility',
    'approval_source', 'user_supplied_whatsapp_manager_screenshot',
    'provider_family', 'meta',
    'template_name_note', 'Preserve exact Meta-approved spelling and casing: custoemr_follow_ip',
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
