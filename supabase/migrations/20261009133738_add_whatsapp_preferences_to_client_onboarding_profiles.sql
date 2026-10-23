alter table public.client_onboarding_profiles
  add column if not exists whatsapp_preferences jsonb not null default '{}'::jsonb;
