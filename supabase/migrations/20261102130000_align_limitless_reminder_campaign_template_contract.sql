begin;

-- The Meta-approved Limitless Realty reminder uses four BODY variables.
-- The existing row carried seven variable_keys while its approved_variable_order
-- already contained the four provider-approved keys, causing strict dispatch
-- validation to reject the template.
update public.whatsapp_template_configs
set
  variable_keys = jsonb_build_array(
    'customer_name',
    'followup_context',
    'property_details',
    'next_step'
  ),
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{approved_variable_order}',
    jsonb_build_array(
      'customer_name',
      'followup_context',
      'property_details',
      'next_step'
    ),
    true
  ),
  status = 'active',
  updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
  and purpose = 'follow_up_outside_24h'
  and template_name = 'limitless_realty_reminder'
  and language_code = 'en_US'
  and metadata->>'provider_status' = 'approved';

do $$
begin
  if not exists (
    select 1
    from public.whatsapp_template_configs
    where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
      and purpose = 'follow_up_outside_24h'
      and template_name = 'limitless_realty_reminder'
      and language_code = 'en_US'
      and status = 'active'
      and metadata->>'provider_status' = 'approved'
      and variable_keys = jsonb_build_array(
        'customer_name',
        'followup_context',
        'property_details',
        'next_step'
      )
      and metadata->'approved_variable_order' = jsonb_build_array(
        'customer_name',
        'followup_context',
        'property_details',
        'next_step'
      )
  ) then
    raise exception 'Limitless Realty reminder template contract is not aligned with its approved four-variable order';
  end if;
end $$;

commit;
