begin;

-- The approved Limitless Realty Meta template uses the seven placeholders
-- supplied by the business owner, in this exact order:
-- client_name, property_title, amount_paid, outstanding_balance,
-- handover_agent_name, handover_agent_phone, company_name.
update public.whatsapp_template_configs
set
  template_name = 'installment_reminder',
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
  and purpose = 'installment_payment_reminder';

update public.reminder_templates
set message_template = $$Hello {{client_name}} 👋

Just a quick update regarding your installment payment for {{property_title}}.

You have currently paid {{amount_paid}}, with {{outstanding_balance}} remaining.

Your installment plan is still active, so we're reaching out with a reminder regarding your payment.

If you need any information or assistance with your payment, please contact {{handover_agent_name}} on WhatsApp: {{handover_agent_phone}}.

We're happy to assist.

Thank you,
{{company_name}} team.$$,
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
  and channel = 'whatsapp'
  and enabled = true;

do $$
begin
  if not exists (
    select 1
    from public.whatsapp_template_configs
    where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
      and purpose = 'installment_payment_reminder'
      and template_name = 'installment_reminder'
      and status = 'active'
      and variable_keys = jsonb_build_array(
        'client_name','property_title','amount_paid','outstanding_balance',
        'handover_agent_name','handover_agent_phone','company_name'
      )
      and metadata->'approved_variable_order' = jsonb_build_array(
        'client_name','property_title','amount_paid','outstanding_balance',
        'handover_agent_name','handover_agent_phone','company_name'
      )
  ) then
    raise exception 'Approved installment_reminder template contract is not configured for Limitless Realty';
  end if;
end $$;

commit;
