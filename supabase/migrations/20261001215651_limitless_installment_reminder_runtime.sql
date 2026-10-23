begin;

create unique index if not exists reminder_attempts_schedule_unique
  on public.reminder_attempts (organization_id, payment_plan_id, reminder_template_id, scheduled_for);

update public.reminder_templates
set timing_direction='before',
    timing_days=3,
    channel='whatsapp',
    message_template='Hi {{client_name}}, this is a reminder that your installment of {{installment_amount}} for {{property_title}} is due on {{due_date}}. Your outstanding balance is {{outstanding_balance}}. Maia, Limitless Realty.',
    escalation_action='If payment remains outstanding after the post-due reminder, flag the plan for human follow-up.',
    enabled=true,
    updated_at=now()
where organization_id='b15f21b4-5697-4d21-9421-8a34eae3476d'
  and position=1;

update public.reminder_templates
set timing_direction='on',
    timing_days=0,
    channel='whatsapp',
    message_template='Hi {{client_name}}, your installment of {{installment_amount}} for {{property_title}} is due today. Your outstanding balance is {{outstanding_balance}}. Maia, Limitless Realty.',
    escalation_action='If payment is not received, allow the post-due reminder and then flag for human follow-up.',
    enabled=true,
    updated_at=now()
where organization_id='b15f21b4-5697-4d21-9421-8a34eae3476d'
  and position=2;

update public.reminder_templates
set timing_direction='after',
    timing_days=3,
    channel='whatsapp',
    message_template='Hi {{client_name}}, we are following up on the installment of {{installment_amount}} for {{property_title}}. Your outstanding balance is {{outstanding_balance}}. Please let Maia know if you need assistance.',
    escalation_action='Flag the installment plan for human follow-up after this reminder.',
    enabled=true,
    updated_at=now()
where organization_id='b15f21b4-5697-4d21-9421-8a34eae3476d'
  and position=3;

commit;