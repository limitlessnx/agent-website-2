-- Xposure studio catalogue backing table.
-- Server routes access this table through the Supabase service-role client and
-- enforce the active Xposure tenant organization on every read/write.
create table if not exists public.studio_catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 140),
  description text not null default '',
  category text not null default 'Photoshoot',
  price_amount numeric(12,2) null check (price_amount is null or price_amount >= 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  duration_minutes integer null check (duration_minutes is null or duration_minutes between 5 and 1440),
  cover_image_url text null,
  media_urls text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft','active','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_catalog_items_org_sort_idx
  on public.studio_catalog_items (organization_id, sort_order asc, created_at desc);

alter table public.studio_catalog_items enable row level security;
revoke all on public.studio_catalog_items from anon, authenticated;
grant all on public.studio_catalog_items to service_role;
