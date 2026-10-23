begin;

alter table public.ai_business_evaluation_sessions
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_consent boolean not null default false;

alter table public.ai_business_evaluation_sessions
  alter column status set default 'started';

alter table public.ai_business_evaluation_sessions
  drop constraint if exists ai_business_evaluation_sessions_status_check;

drop index if exists public.ai_business_evaluation_sessions_updated_idx;
create index if not exists ai_business_evaluation_sessions_email_idx
  on public.ai_business_evaluation_sessions (contact_email);
create index if not exists ai_business_evaluation_sessions_status_idx
  on public.ai_business_evaluation_sessions (status);

alter table public.ai_business_evaluation_sessions enable row level security;
alter table public.evaluation_implementation_opportunities enable row level security;
revoke all on public.ai_business_evaluation_sessions, public.evaluation_implementation_opportunities from anon, authenticated;
grant all on public.ai_business_evaluation_sessions, public.evaluation_implementation_opportunities to service_role;

commit;
