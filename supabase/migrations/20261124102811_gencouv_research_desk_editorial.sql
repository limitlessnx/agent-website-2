create table if not exists public.gencouv_research_team (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('analyst','reviewer','admin')),
 display_name text not null default 'Research team member',
 created_at timestamptz not null default now()
);
alter table public.gencouv_research_team enable row level security;
revoke all on public.gencouv_research_team from anon, authenticated;

create table if not exists public.gencouv_research_reports (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 title text not null check(char_length(title) between 8 and 170),
 market text not null check(market in ('stocks','crypto','macro')),
 format text not null default 'research_note' check(format in ('research_note','market_brief','deep_dive','thesis_update')),
 summary text not null check(char_length(summary) between 20 and 1200),
 thesis text not null check(char_length(thesis) between 30 and 15000),
 evidence text not null default '',
 risks text not null check(char_length(risks) between 30 and 15000),
 invalidation text not null check(char_length(invalidation) between 15 and 8000),
 sources text not null default '',
 conflict_disclosure text not null default '',
 status text not null default 'draft' check(status in ('draft','submitted','approved','published','rejected')),
 access_level text not null default 'public' check(access_level in ('public','premium')),
 created_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.gencouv_research_reports enable row level security;
revoke all on public.gencouv_research_reports from anon, authenticated;
create index if not exists gencouv_research_reports_status_idx on public.gencouv_research_reports(status, published_at desc);
create index if not exists gencouv_research_reports_market_idx on public.gencouv_research_reports(market, published_at desc);
comment on table public.gencouv_research_reports is 'Research editorial workflow only; publication and email delivery are separate approved actions. No automatic investment calls.';
create table if not exists public.gencouv_research_audit (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.gencouv_research_reports(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('created','edited','submitted','approved','rejected','published')),
 created_at timestamptz not null default now()
);
alter table public.gencouv_research_audit enable row level security;
revoke all on public.gencouv_research_audit from anon, authenticated;
