update public.billing_plans
set metadata = jsonb_set(
  jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{international}',
    '{"currency":"USD","installation_fee":400,"recurring_fee":200}'::jsonb,
    true
  ),
  '{public_catalog}',
  'true'::jsonb,
  true
),
updated_at = now()
where slug = 'whatsapp-ai-starter';

update public.billing_plans
set metadata = jsonb_set(
  jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{international}',
    '{"currency":"USD","installation_fee":600,"recurring_fee":350}'::jsonb,
    true
  ),
  '{public_catalog}',
  'true'::jsonb,
  true
),
updated_at = now()
where slug = 'ai-call-receptionist';

update public.billing_plans
set metadata = jsonb_set(
  jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{international}',
    '{"currency":"USD","installation_fee":1200,"recurring_fee":700}'::jsonb,
    true
  ),
  '{public_catalog}',
  'true'::jsonb,
  true
),
updated_at = now()
where slug = 'ai-front-desk-suite';
