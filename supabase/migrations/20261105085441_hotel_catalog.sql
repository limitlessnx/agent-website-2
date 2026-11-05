-- Hotel catalog: tenant-scoped editorial content and private media. No live sends.
create table public.hotel_catalog_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 kind text not null check(kind in ('room','service')), room_type_id uuid,
 title text not null default '' check(length(title)<=120), description text not null default '' check(length(description)<=4000),
 amenities text[] not null default '{}' check(cardinality(amenities)<=30), bed_options text not null default '' check(length(bed_options)<=200),
 pricing text not null default 'confirm' check(pricing in ('included','paid','confirm')),
 price_minor bigint check(price_minor>=0 and price_minor<=1000000000000), currency text check(currency ~ '^[A-Z]{3}$'),
 price_unit text not null default 'per session' check(price_unit in ('per session','per person','per day','per stay')),
 opening_hours text not null default '' check(length(opening_hours)<=500), booking_instructions text not null default '' check(length(booking_instructions)<=2000),
 status text not null default 'draft' check(status in ('draft','published','archived')), revision integer not null default 1,
 creation_hash text not null, updated_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id),
 constraint hotel_catalog_items_room_type_fkey foreign key(organization_id,room_type_id) references public.hotel_room_types(organization_id,id),
 check((kind='room' and room_type_id is not null and price_minor is null and currency is null) or (kind='service' and room_type_id is null and length(trim(title))>0)),
 check(kind='room' or (pricing='paid' and price_minor is not null and currency is not null) or (pricing<>'paid' and price_minor is null and currency is null))
);
create unique index hotel_catalog_room_type_unique on public.hotel_catalog_items(organization_id,room_type_id) where room_type_id is not null;
create index hotel_catalog_tenant_status on public.hotel_catalog_items(organization_id,status);
create table public.hotel_catalog_media (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), item_id uuid not null,
 storage_path text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','video/mp4')),
 size_bytes integer not null check(size_bytes between 1 and 16777216), caption text not null default '' check(length(caption)<=200),
 status text not null default 'pending' check(status in ('pending','ready','removed')), position integer not null default 0 check(position between 0 and 99),
 created_at timestamptz not null default now(),
 foreign key(organization_id,item_id) references public.hotel_catalog_items(organization_id,id),
 check(storage_path like organization_id::text || '/' || item_id::text || '/%'),
 check(mime_type='video/mp4' or size_bytes<=6291456)
);
create index hotel_catalog_media_item on public.hotel_catalog_media(organization_id,item_id);
create function public.hotel_catalog_item_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='INSERT' then
  if new.status<>'draft' then raise exception 'Create a draft before publishing'; end if;
  new.revision:=1;
 else
  if (new.id,new.organization_id,new.kind,new.room_type_id,new.creation_hash) is distinct from (old.id,old.organization_id,old.kind,old.room_type_id,old.creation_hash) then raise exception 'Catalog identity is immutable'; end if;
  if old.status<>'draft' and (to_jsonb(new)-array['status','revision','updated_at','updated_by']) is distinct from (to_jsonb(old)-array['status','revision','updated_at','updated_by']) then raise exception 'Move this entry to draft before editing'; end if;
  new.revision:=old.revision+1;
 end if;
 if new.status='published' then
  if length(trim(new.description))=0 then raise exception 'Add a description before publishing'; end if;
  if exists(select 1 from hotel_catalog_media where organization_id=new.organization_id and item_id=new.id and status='pending') then raise exception 'Finish or remove pending uploads before publishing'; end if;
 end if;
 new.updated_at:=now();return new;
end $$;
create trigger hotel_catalog_item_guard before insert or update on public.hotel_catalog_items for each row execute function public.hotel_catalog_item_guard();
create function public.hotel_catalog_media_guard() returns trigger language plpgsql set search_path=public as $$
declare item public.hotel_catalog_items;
begin
 select * into item from hotel_catalog_items where organization_id=new.organization_id and id=new.item_id for update;
 if not found or item.status<>'draft' then raise exception 'Media can only change on a draft in this hotel'; end if;
 if TG_OP='INSERT' then
  if new.status<>'pending' then raise exception 'Verify uploaded media first'; end if;
  if (select count(*) from hotel_catalog_media where organization_id=new.organization_id and item_id=new.item_id and status<>'removed')>=12 then raise exception 'A catalog entry supports up to 12 media files'; end if;
 else
  if (new.id,new.organization_id,new.item_id,new.storage_path,new.mime_type,new.size_bytes) is distinct from (old.id,old.organization_id,old.item_id,old.storage_path,old.mime_type,old.size_bytes) then raise exception 'Media identity is immutable'; end if;
  if old.status='removed' or (old.status='ready' and new.status='pending') then raise exception 'Invalid media transition'; end if;
 end if;
 update hotel_catalog_items set updated_at=now() where id=item.id and organization_id=item.organization_id;
 return new;
end $$;
create trigger hotel_catalog_media_guard before insert or update on public.hotel_catalog_media for each row execute function public.hotel_catalog_media_guard();
alter table public.hotel_catalog_items enable row level security;
alter table public.hotel_catalog_media enable row level security;
grant select on public.hotel_catalog_items,public.hotel_catalog_media to authenticated;
grant all on public.hotel_catalog_items,public.hotel_catalog_media to service_role;
create policy hotel_catalog_member_read on public.hotel_catalog_items for select to authenticated using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
create policy hotel_catalog_media_member_read on public.hotel_catalog_media for select to authenticated using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
revoke all on function public.hotel_catalog_item_guard(),public.hotel_catalog_media_guard() from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('hotel-catalog','hotel-catalog',false,16777216,array['image/jpeg','image/png','image/webp','video/mp4']);
-- No client object policies: server authorization controls uploads and signed reads.
-- Restrictive guard also protects this bucket if an older broad object policy exists.
create policy hotel_catalog_server_objects_only on storage.objects as restrictive for all to anon,authenticated
using(bucket_id<>'hotel-catalog') with check(bucket_id<>'hotel-catalog');
