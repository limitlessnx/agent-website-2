update public.billing_plans
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'flutterwave_payment_plans', coalesce(metadata->'flutterwave_payment_plans','{}'::jsonb)
)
where slug in ('whatsapp-ai-starter','ai-call-receptionist','ai-front-desk-suite');
