create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'limitless-public-media',
  'limitless-public-media',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.properties
  add column if not exists image_urls jsonb not null default '[]'::jsonb,
  add column if not exists cover_image_url text;

alter table public.media_assets
  alter column storage_bucket set default 'limitless-public-media';

create index if not exists media_assets_property_id_idx on public.media_assets (property_id);
create index if not exists media_assets_whatsapp_phone_idx on public.media_assets (whatsapp_phone);

comment on column public.properties.image_urls is 'Public Supabase Storage image URLs for this property.';
comment on column public.properties.cover_image_url is 'Primary public Supabase Storage image URL for this property.';
