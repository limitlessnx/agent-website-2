create table if not exists public.photography_catalogue_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  cover_image_url text,
  display_order integer not null default 0 check (display_order >= 0),
  status text not null default 'active' check (status in ('draft','active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, slug)
);

create table if not exists public.photography_catalogue_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null,
  name text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','active','archived')),
  price_minor bigint check (price_minor is null or price_minor >= 0),
  currency text not null default 'NGN',
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  availability jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, category_id)
    references public.photography_catalogue_categories(organization_id, id) on delete cascade
);

create table if not exists public.photography_catalogue_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  storage_path text not null,
  alt_text text not null default '',
  display_order integer not null default 0 check (display_order >= 0),
  status text not null default 'active' check (status in ('draft','active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, item_id)
    references public.photography_catalogue_items(organization_id, id) on delete cascade
);

create table if not exists public.photography_booking_metadata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null,
  shoot_type text not null default 'other' check (shoot_type in ('portrait','wedding','maternity','birthday','family','creative_set','other')),
  catalogue_item_id uuid,
  assigned_photographer_id uuid references auth.users(id) on delete set null,
  studio_location text,
  deposit_status text not null default 'not_required' check (deposit_status in ('not_required','pending','partial','paid','refunded','failed')),
  delivery_status text not null default 'not_started' check (delivery_status in ('not_started','in_progress','delivered','cancelled')),
  client_notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, appointment_id),
  foreign key (organization_id, appointment_id)
    references public.appointments(organization_id, id) on delete cascade,
  foreign key (organization_id, catalogue_item_id)
    references public.photography_catalogue_items(organization_id, id) on delete set null
);

create index if not exists photography_catalogue_categories_org_order_idx
  on public.photography_catalogue_categories(organization_id, status, display_order);
create index if not exists photography_catalogue_items_org_category_idx
  on public.photography_catalogue_items(organization_id, category_id, status, created_at desc);
create index if not exists photography_catalogue_media_org_item_idx
  on public.photography_catalogue_media(organization_id, item_id, display_order);
create index if not exists photography_booking_metadata_org_shoot_idx
  on public.photography_booking_metadata(organization_id, shoot_type, delivery_status);

alter table public.photography_catalogue_categories enable row level security;
alter table public.photography_catalogue_items enable row level security;
alter table public.photography_catalogue_media enable row level security;
alter table public.photography_booking_metadata enable row level security;

drop policy if exists photography_catalogue_categories_member_access on public.photography_catalogue_categories;
create policy photography_catalogue_categories_member_access on public.photography_catalogue_categories
  for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists photography_catalogue_items_member_access on public.photography_catalogue_items;
create policy photography_catalogue_items_member_access on public.photography_catalogue_items
  for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists photography_catalogue_media_member_access on public.photography_catalogue_media;
create policy photography_catalogue_media_member_access on public.photography_catalogue_media
  for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists photography_booking_metadata_member_access on public.photography_booking_metadata;
create policy photography_booking_metadata_member_access on public.photography_booking_metadata
  for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

grant select, insert, update, delete on public.photography_catalogue_categories to authenticated;
grant select, insert, update, delete on public.photography_catalogue_items to authenticated;
grant select, insert, update, delete on public.photography_catalogue_media to authenticated;
grant select, insert, update, delete on public.photography_booking_metadata to authenticated;
grant all on public.photography_catalogue_categories to service_role;
grant all on public.photography_catalogue_items to service_role;
grant all on public.photography_catalogue_media to service_role;
grant all on public.photography_booking_metadata to service_role;

drop trigger if exists photography_catalogue_categories_set_updated_at on public.photography_catalogue_categories;
create trigger photography_catalogue_categories_set_updated_at before update on public.photography_catalogue_categories for each row execute function public.set_updated_at();
drop trigger if exists photography_catalogue_items_set_updated_at on public.photography_catalogue_items;
create trigger photography_catalogue_items_set_updated_at before update on public.photography_catalogue_items for each row execute function public.set_updated_at();
drop trigger if exists photography_catalogue_media_set_updated_at on public.photography_catalogue_media;
create trigger photography_catalogue_media_set_updated_at before update on public.photography_catalogue_media for each row execute function public.set_updated_at();
drop trigger if exists photography_booking_metadata_set_updated_at on public.photography_booking_metadata;
create trigger photography_booking_metadata_set_updated_at before update on public.photography_booking_metadata for each row execute function public.set_updated_at();

insert into public.photography_catalogue_categories (organization_id, slug, name, description, cover_image_url, display_order)
select p.organization_id, seed.slug, seed.name, seed.description, seed.cover_image_url, seed.display_order
from public.client_onboarding_profiles p
cross join (values
  ('portraits','Portraits','Individual portraits, headshots and personal branding sessions','/exposure/portraits.jpg',1),
  ('weddings','Weddings','Couples, ceremonies and full wedding-day packages','/exposure/weddings.jpg',2),
  ('maternity','Maternity','Maternity, newborn and family milestone sessions','/exposure/maternity.jpg',3),
  ('birthdays','Birthdays','Birthday portraits, celebrations and event coverage','/exposure/birthdays.jpg',4),
  ('family','Family','Family sessions, lifestyle portraits and group packages','/exposure/family.jpg',5),
  ('creative-sets','Creative sets','Studio concepts, seasonal sets and campaign-ready ideas','/exposure/creative-sets.jpg',6)
) as seed(slug,name,description,cover_image_url,display_order)
where p.industry = 'photography-studio'
on conflict (organization_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  cover_image_url = coalesce(public.photography_catalogue_categories.cover_image_url, excluded.cover_image_url),
  display_order = excluded.display_order,
  updated_at = now();

comment on table public.photography_catalogue_categories is 'Tenant-scoped Xposure studio catalogue categories.';
comment on table public.photography_catalogue_items is 'Tenant-scoped Xposure packages and shoot offerings.';
comment on table public.photography_catalogue_media is 'Tenant-scoped sample media attached to Xposure catalogue items.';
comment on table public.photography_booking_metadata is 'Tenant-scoped photography metadata attached to canonical appointments.';
