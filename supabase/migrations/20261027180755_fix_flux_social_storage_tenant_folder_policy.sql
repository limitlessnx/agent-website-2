-- Fix tenant folder isolation for private Flux Social assets.
-- Explicitly qualify storage.objects.name so the subquery cannot resolve name
-- to public.organizations.name. No bucket visibility or data is changed.
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
    where o.id::text = (storage.foldername(storage.objects.name))[1]
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
    where o.id::text = (storage.foldername(storage.objects.name))[1]
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
    where o.id::text = (storage.foldername(storage.objects.name))[1]
      and public.is_organization_member(o.id)
  )
)
with check (
  bucket_id = 'flux-social-assets'
  and exists (
    select 1
    from public.organizations o
    where o.id::text = (storage.foldername(storage.objects.name))[1]
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
    where o.id::text = (storage.foldername(storage.objects.name))[1]
      and public.is_organization_member(o.id)
  )
);
