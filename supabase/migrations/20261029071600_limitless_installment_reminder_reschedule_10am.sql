begin;

-- The approved Limitless Realty reminder is the single active local template.
update public.reminder_templates
set enabled = false, updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
  and channel = 'whatsapp';

update public.reminder_templates
set name = 'installment_reminder',
    timing_direction = 'on',
    timing_days = 0,
    position = 1,
    enabled = true,
    message_template = $$Hello {{client_name}} 👋

Just a quick update regarding your installment payment for {{property_title}}.

You have currently paid {{amount_paid}}, with {{outstanding_balance}} remaining.

Your installment plan is still active, so we're reaching out with a reminder regarding your payment.

If you need any information or assistance with your payment, please contact {{handover_agent_name}} on WhatsApp: {{handover_agent_phone}}.

We're happy to assist.

Thank you,
{{company_name}} team.$$,
    updated_at = now()
where id = '9167a170-57ee-4511-a0ac-6be4a238bcfa'
  and organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d';

-- The missed October 28 run is rescheduled for October 29 at 10:00 Lagos;
-- the next installment reminder cursor is fourteen days later.
update public.payment_plans
set reminder_template_id = '9167a170-57ee-4511-a0ac-6be4a238bcfa',
    next_due_date = date '2026-11-12',
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
  and payment_type = 'installment'
  and status = 'active'
  and reminders_enabled = true
  and outstanding_balance > 0;

update public.payment_plans
set next_reminder_at = timestamptz '2026-10-29 09:00:00+00', updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
  and payment_type = 'installment'
  and status = 'active'
  and reminders_enabled = true
  and outstanding_balance > 0;

update public.whatsapp_template_configs
set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{company_name}', to_jsonb('Limitless Realty'::text), true),
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
  and purpose = 'installment_payment_reminder'
  and template_name = 'installment_reminder';

commit;
