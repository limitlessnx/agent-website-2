-- Tenant-scoped catalogue for photography services and studio reference media.
create table if not exists public.studio_catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 140),
  description text not null default '',
  category text not null default 'Photoshoot',
  price_amount numeric(12,2),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 1440),
  cover_image_url text,
  media_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(media_urls) = 'array'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index if not exists studio_catalog_items_org_status_order_idx
  on public.studio_catalog_items (organization_id, status, sort_order, created_at desc);
alter table public.studio_catalog_items enable row level security;
revoke all on public.studio_catalog_items from public, anon, authenticated;
grant all on public.studio_catalog_items to service_role;
comment on table public.studio_catalog_items is 'Organization-scoped service packages and approved reference media for photography studios; not property inventory.';
