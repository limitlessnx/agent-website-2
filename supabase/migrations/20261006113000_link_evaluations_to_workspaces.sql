alter table public.ai_business_evaluation_sessions add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.ai_business_evaluation_sessions add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.ai_business_evaluation_sessions add column if not exists claimed_at timestamptz;
create index if not exists ai_business_evaluation_sessions_org_updated_idx on public.ai_business_evaluation_sessions(organization_id,updated_at desc);
