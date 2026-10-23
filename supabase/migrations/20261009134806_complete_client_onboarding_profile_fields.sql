alter table public.client_onboarding_profiles
  add column if not exists business_description text,
  add column if not exists ai_requirements text,
  add column if not exists business_knowledge jsonb not null default '{}'::jsonb;
