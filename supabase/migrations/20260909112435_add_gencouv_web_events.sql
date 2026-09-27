create table if not exists public.gencouv_web_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_name text not null check (event_name in ('page_view','telegram_cta_click','email_campaign_landing')),
  session_id text not null,
  page text,
  landing_page text,
  cta_name text,
  campaign text,
  cohort text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  device text,
  country text,
  user_agent text
);

create index if not exists gencouv_web_events_created_at_idx on public.gencouv_web_events (created_at desc);
create index if not exists gencouv_web_events_event_name_idx on public.gencouv_web_events (event_name);
create index if not exists gencouv_web_events_session_id_idx on public.gencouv_web_events (session_id);
create index if not exists gencouv_web_events_utm_campaign_idx on public.gencouv_web_events (utm_campaign);

alter table public.gencouv_web_events enable row level security;
