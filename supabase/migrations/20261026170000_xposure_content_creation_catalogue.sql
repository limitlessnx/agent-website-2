-- Xposure-only catalogue extension. Adds a dedicated content creation category.
-- Does not create package prices or assert availability; staff configure those in the tenant dashboard.
insert into public.photography_catalogue_categories
  (organization_id, slug, name, description, cover_image_url, display_order, status, metadata)
select o.id, 'content-creation', 'Content Creation',
       'Reels, TikTok, brand videos and creator studio sessions',
       null, 7, 'active', jsonb_build_object('booking_cta', true, 'illustrative_cover', true)
from public.organizations o
where o.slug = 'xposure'
on conflict (organization_id, slug) do update
set name = excluded.name,
    description = excluded.description,
    display_order = excluded.display_order,
    status = 'active',
    metadata = coalesce(public.photography_catalogue_categories.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();
