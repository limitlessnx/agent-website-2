create table if not exists public.gencouv_research_subscribers (
 email text primary key,
 status text not null default 'pending' check (status in ('pending','active','unsubscribed')),
 consent_scope text not null default 'research_newsletter',
 consent_source text not null default 'investment_intelligence_page',
 consent_at timestamptz not null default now(),
 verified_at timestamptz,
 token_hash text,
 token_expires_at timestamptz,
 last_confirmation_sent_at timestamptz,
 unsubscribed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint research_subscribers_email_format check (length(email) <= 254 and position('@' in email) > 1)
);
alter table public.gencouv_research_subscribers enable row level security;
revoke all on table public.gencouv_research_subscribers from anon, authenticated;
create index if not exists gencouv_research_subscribers_status_idx on public.gencouv_research_subscribers(status);
comment on table public.gencouv_research_subscribers is 'Research newsletter subscribers only. No implied consent for EA, copy trading, or unrelated outbound campaigns.';
