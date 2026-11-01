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
  'limitless_realty_relationship_campaign',
  'limitless_realty_relationship_campaign',
  'en',
  '["customer_name","greeting","call_to_action"]'::jsonb,
  'active',
  jsonb_build_object(
    'agent', 'maia',
    'channel', 'whatsapp',
    'organization_slug', 'limitless-realty',
    'provider_status', 'approved',
    'approval_source', 'user_confirmed_meta_approval',
    'approved_variable_order', '["customer_name","greeting","call_to_action"]'::jsonb,
    'campaign_purposes', '["new_week","new_month","celebration","festive","customer_appreciation"]'::jsonb
  ),
  now()
)
on conflict (organization_id, purpose) do update
set
  template_name = excluded.template_name,
  language_code = excluded.language_code,
  variable_keys = excluded.variable_keys,
  status = 'active',
  metadata = excluded.metadata,
  updated_at = now();

do $$
begin
  if not exists (
    select 1
    from public.whatsapp_template_configs
    where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
      and purpose = 'limitless_realty_relationship_campaign'
      and template_name = 'limitless_realty_relationship_campaign'
      and language_code = 'en'
      and status = 'active'
      and variable_keys = '["customer_name","greeting","call_to_action"]'::jsonb
      and metadata->>'provider_status' = 'approved'
  ) then
    raise exception 'Limitless Realty relationship campaign template contract was not registered';
  end if;
end $$;
