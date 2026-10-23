begin;

insert into public.whatsapp_template_configs
  (organization_id, purpose, template_name, language_code, variable_keys, status, metadata)
select
  o.id::text,
  'human_handoff_staff',
  'hand_over_',
  'en',
  '["business_name","customer_name","customer_phone","handoff_reason","conversation_summary"]'::jsonb,
  'active',
  '{"category":"utility","approval_source":"user_confirmed_meta_whatsapp_manager","provider_family":"meta","variable_mapping_version":1}'::jsonb
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
