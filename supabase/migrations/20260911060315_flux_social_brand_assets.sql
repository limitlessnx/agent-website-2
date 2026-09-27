create table if not exists public.social_brand_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid not null,
  asset_role text not null check (asset_role in ('logo_primary','logo_inverse','logo_mark','logo_wordmark','font_reference','color_reference','other')),
  social_asset_id uuid null,
  name text not null,
  variant text null,
  usage_rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, brand_id, asset_role, name),
  foreign key (organization_id, brand_id) references public.social_brands (organization_id, id) on delete cascade,
  foreign key (organization_id, social_asset_id) references public.social_assets (organization_id, id) on delete set null
);

create index if not exists social_brand_assets_org_brand_idx on public.social_brand_assets (organization_id, brand_id, is_active);

alter table public.social_brand_assets enable row level security;

drop policy if exists social_brand_assets_member_all on public.social_brand_assets;
create policy social_brand_assets_member_all on public.social_brand_assets
for all to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists social_brand_assets_service_all on public.social_brand_assets;
create policy social_brand_assets_service_all on public.social_brand_assets
for all to service_role
using (true)
with check (true);

drop trigger if exists set_social_brand_assets_updated_at on public.social_brand_assets;
create trigger set_social_brand_assets_updated_at before update on public.social_brand_assets
for each row execute function public.set_updated_at();
