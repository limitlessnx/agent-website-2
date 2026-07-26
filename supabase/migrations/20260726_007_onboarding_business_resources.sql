alter table public.client_onboarding_submissions
  add column if not exists business_resources jsonb not null default '{}'::jsonb;

comment on column public.client_onboarding_submissions.business_resources is
  'Client-provided descriptions and references for logos, catalogues, SOPs, price lists, and knowledge documents. File records live in client_onboarding_documents.';
