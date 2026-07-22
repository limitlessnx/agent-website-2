create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Unknown',
  full_name text,
  client_name text,
  profile_name text,
  phone text,
  whatsapp text,
  whatsapp_id text,
  "from" text,
  status text not null default 'new',
  lead_status text,
  score text default 'unscored',
  lead_score text,
  budget text,
  price_range text,
  location_preference text,
  preferred_location text,
  property_type text,
  purpose text,
  timeline text,
  payment_method text,
  source text,
  current_message text,
  conversation_summary text,
  follow_up_stage integer not null default 0,
  follow_up_due_at timestamptz,
  last_contacted_at timestamptz,
  last_follow_up_at timestamptz,
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  opted_out boolean not null default false,
  viewing_booked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists leads_phone_unique_not_null on public.leads (phone) where phone is not null and phone <> '';
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_follow_up_stage_idx on public.leads (follow_up_stage);

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled property',
  name text,
  property_name text,
  location text,
  location_area text,
  area text,
  location_city text,
  city text,
  price text,
  amount text,
  price_ngn text,
  type text,
  property_type text,
  status text not null default 'active',
  size text,
  size_sqm text,
  land_size text,
  drive_photos_link text,
  photos_link text,
  image_url text,
  image_urls text,
  cover_image_url text,
  drive_brochure_link text,
  features text,
  title_details text,
  description text,
  brief text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_status_idx on public.properties (status);
create index if not exists properties_title_idx on public.properties (title);

drop trigger if exists set_properties_updated_at on public.properties;
create trigger set_properties_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create table if not exists public.bot_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  role text not null,
  content text,
  draft_content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_sessions_role_idx on public.bot_sessions (role);
create index if not exists bot_sessions_user_id_idx on public.bot_sessions (user_id);
create index if not exists bot_sessions_created_at_idx on public.bot_sessions (created_at desc);

drop trigger if exists set_bot_sessions_updated_at on public.bot_sessions;
create trigger set_bot_sessions_updated_at
before update on public.bot_sessions
for each row execute function public.set_updated_at();
