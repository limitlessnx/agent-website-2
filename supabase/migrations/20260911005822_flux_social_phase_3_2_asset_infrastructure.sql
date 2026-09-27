create table if not exists public.social_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id uuid null,
  brand_id uuid null,
  asset_type text not null check (asset_type in ('image','carousel_slide','video','reel','audio','thumbnail','screenshot','other')),
  source text not null default 'upload' check (source in ('upload','openai','remotion','elevenlabs','system','external')),
  status text not null default 'ready' check (status in ('pending','generating','ready','failed','archived')),
  bucket_id text not null default 'flux-social-assets',
  storage_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  provider_asset_id text,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, bucket_id, storage_path),
  constraint social_assets_post_fk foreign key (organization_id, post_id)
    references public.social_posts(organization_id, id) on delete cascade,
  constraint social_assets_brand_fk foreign key (organization_id, brand_id)
    references public.social_brands(organization_id, id) on delete cascade
);

create index if not exists social_assets_org_post_idx on public.social_assets (organization_id, post_id, created_at desc);
create index if not exists social_assets_org_status_idx on public.social_assets (organization_id, status, created_at desc);

alter table public.social_assets enable row level security;

drop policy if exists "Organization members manage social assets" on public.social_assets;
create policy "Organization members manage social assets"
on public.social_assets
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

grant select, insert, update, delete on public.social_assets to authenticated;
grant all on public.social_assets to service_role;

drop trigger if exists set_social_assets_updated_at on public.social_assets;
create trigger set_social_assets_updated_at
before update on public.social_assets
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flux-social-assets',
  'flux-social-assets',
  false,
  52428800,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/wav','audio/x-wav','audio/mp4'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Flux Social members read assets" on storage.objects;
create policy "Flux Social members read assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'flux-social-assets'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
      and public.is_organization_member(o.id)
  )
);

drop policy if exists "Flux Social members upload assets" on storage.objects;
create policy "Flux Social members upload assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'flux-social-assets'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
      and public.is_organization_member(o.id)
  )
);

drop policy if exists "Flux Social members update assets" on storage.objects;
create policy "Flux Social members update assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'flux-social-assets'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
      and public.is_organization_member(o.id)
  )
)
with check (
  bucket_id = 'flux-social-assets'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
      and public.is_organization_member(o.id)
  )
);

drop policy if exists "Flux Social members delete assets" on storage.objects;
create policy "Flux Social members delete assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'flux-social-assets'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(name))[1]
      and public.is_organization_member(o.id)
  )
);
