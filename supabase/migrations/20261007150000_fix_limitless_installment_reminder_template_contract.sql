update public.whatsapp_template_configs
set
  variable_keys = jsonb_build_array(
    'client_name',
    'property_title',
    'amount_paid',
    'outstanding_balance',
    'handover_agent_name',
    'handover_agent_phone',
    'company_name'
  ),
  status = 'active',
  metadata = (coalesce(metadata, '{}'::jsonb) - 'activation_gate') || jsonb_build_object(
    'agent', 'maia',
    'channel', 'whatsapp',
    'provider_status', 'approved',
    'organization_slug', 'limitless-realty',
    'approved_template_scope', 'installment_payment_reminder',
    'approved_variable_order', jsonb_build_array(
      'client_name',
      'property_title',
      'amount_paid',
      'outstanding_balance',
      'handover_agent_name',
      'handover_agent_phone',
      'company_name'
    )
  ),
  updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
  and purpose = 'installment_payment_reminder'
  and template_name = 'limitless_realty_reminder'
  and language_code = 'en_US';

do $$
begin
  if not exists (
    select 1
    from public.whatsapp_template_configs
    where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
      and purpose = 'installment_payment_reminder'
      and template_name = 'limitless_realty_reminder'
      and language_code = 'en_US'
      and status = 'active'
      and variable_keys = jsonb_build_array(
        'client_name','property_title','amount_paid','outstanding_balance',
        'handover_agent_name','handover_agent_phone','company_name'
      )
  ) then
    raise exception 'Approved Limitless Realty installment reminder template contract is not active';
  end if;
end $$;
