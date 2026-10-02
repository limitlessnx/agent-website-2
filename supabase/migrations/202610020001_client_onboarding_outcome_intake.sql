alter table public.client_onboarding_profiles
  add column if not exists business_description text,
  add column if not exists ai_requirements text,
  add column if not exists business_knowledge jsonb not null default '{}'::jsonb,
  add column if not exists whatsapp_preferences jsonb not null default '{}'::jsonb;

comment on column public.client_onboarding_profiles.business_description is 'Plain-language description supplied by the client describing what the business does.';
comment on column public.client_onboarding_profiles.ai_requirements is 'Plain-language description of what the client wants the AI team to handle.';
comment on column public.client_onboarding_profiles.business_knowledge is 'Client-provided business facts such as services, FAQs, pricing, hours, policies and booking information.';
comment on column public.client_onboarding_profiles.whatsapp_preferences is 'Managed WhatsApp onboarding preferences. Provider credentials and technical identifiers are never collected here.';
