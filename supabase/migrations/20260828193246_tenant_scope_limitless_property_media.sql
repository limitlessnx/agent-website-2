alter table public.properties add column if not exists organization_id uuid;
alter table public.media_assets add column if not exists organization_id uuid;

update public.properties
set organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
where organization_id is null;

update public.media_assets
set organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
where organization_id is null;

alter table public.properties alter column organization_id set not null;
alter table public.media_assets alter column organization_id set not null;

alter table public.properties
  add constraint properties_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.media_assets
  add constraint media_assets_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

create unique index if not exists properties_organization_id_id_key
  on public.properties (organization_id, id);

alter table public.media_assets
  alter column property_id type uuid using nullif(property_id, '')::uuid;

alter table public.media_assets
  add constraint media_assets_property_tenant_fkey
  foreign key (organization_id, property_id)
  references public.properties(organization_id, id)
  on delete cascade;

create index if not exists properties_org_status_title_idx
  on public.properties (organization_id, status, title);

create index if not exists media_assets_org_property_idx
  on public.media_assets (organization_id, property_id, created_at desc);
