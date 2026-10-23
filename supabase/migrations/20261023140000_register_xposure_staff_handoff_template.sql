begin;

-- Register the Meta-approved Xposure staff handoff template in the tenant-scoped
-- registry. The organization is resolved by slug so no generated tenant ID is
-- hardcoded into this migration.
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
select
  o.id::text,
  'human_handoff_staff',
  'hand_over_',
  'en',
  '["business_name","customer_name","customer_phone","handoff_reason","conversation_summary"]'::jsonb,
  'active',
  jsonb_build_object(
    'provider_family', 'meta',
    'category', 'utility',
    'approval_source', 'user_confirmed_meta_whatsapp_manager',
    'variable_mapping_version', 1
  ),
  now()
from public.organizations o
where o.slug = 'xposure'
on conflict (organization_id, purpose) do update
set
  template_name = excluded.template_name,
  language_code = excluded.language_code,
  variable_keys = excluded.variable_keys,
  status = excluded.status,
  metadata = public.whatsapp_template_configs.metadata || excluded.metadata,
  updated_at = now();

commit;
