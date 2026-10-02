begin;

-- Installment reminders are relationship check-ins, not due-date pressure.
-- Keep a single active WhatsApp template and let each payment plan cadence
-- determine whether the check-in runs every 14 or 30 days.
update public.reminder_templates
set enabled = false,
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d';

update public.reminder_templates
set timing_direction = 'on',
    timing_days = 14,
    channel = 'whatsapp',
    message_template = 'Hi {{client_name}}, just checking in from Limitless Realty regarding your {{property_title}} payment plan. Your current outstanding balance is {{outstanding_balance}}. If you need any assistance with your payment plan, Maia is here to help.',
    escalation_action = 'No escalation. This is a routine customer check-in.',
    enabled = true,
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
  and position = 1;

commit;
