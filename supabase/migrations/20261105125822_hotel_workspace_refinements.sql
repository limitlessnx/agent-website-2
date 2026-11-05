-- Prepared for review: stable tenant references, full-history pages and media ordering.
alter table public.hotel_booking_enquiries add constraint hotel_booking_tenant_id_unique unique(organization_id,id);
create table public.hotel_booking_reference_counters(organization_id uuid primary key references public.organizations(id),last_number bigint not null check(last_number>0));
create table public.hotel_booking_references(
 organization_id uuid not null,booking_id uuid not null,number bigint not null check(number>0),
 primary key(organization_id,booking_id),unique(organization_id,number),
 foreign key(organization_id,booking_id) references public.hotel_booking_enquiries(organization_id,id)
);
-- Separate reference metadata leaves booking revisions, reminders and audit history untouched.
lock table public.hotel_booking_enquiries in share row exclusive mode;
insert into public.hotel_booking_references(organization_id,booking_id,number)
select organization_id,id,row_number() over(partition by organization_id order by created_at,id) from public.hotel_booking_enquiries;
insert into public.hotel_booking_reference_counters select organization_id,max(number) from public.hotel_booking_references group by organization_id;
create function public.hotel_assign_booking_reference() returns trigger language plpgsql security invoker set search_path=public as $$
declare next_number bigint;
begin
 insert into hotel_booking_reference_counters(organization_id,last_number) values(new.organization_id,1)
 on conflict(organization_id) do update set last_number=hotel_booking_reference_counters.last_number+1 returning last_number into next_number;
 insert into hotel_booking_references values(new.organization_id,new.id,next_number);return new;
end $$;
create trigger hotel_assign_booking_reference after insert on public.hotel_booking_enquiries for each row execute function public.hotel_assign_booking_reference();
alter table public.hotel_booking_reference_counters enable row level security;
alter table public.hotel_booking_references enable row level security;
revoke all on public.hotel_booking_reference_counters,public.hotel_booking_references from anon,authenticated;
grant all on public.hotel_booking_reference_counters,public.hotel_booking_references to service_role;
grant select on public.hotel_booking_references to authenticated;
create policy hotel_booking_reference_read on public.hotel_booking_references for select to authenticated using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
revoke all on function public.hotel_assign_booking_reference() from public,anon,authenticated;

create function public.hotel_workspace_page(p_organization_id uuid,p_query text,p_status text,p_arrival_day date,p_departure_day date,p_page integer,p_pending_only boolean,p_arrival date,p_departure date,p_guests integer)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 if p_organization_id is null or length(coalesce(p_query,''))>120 or p_page is null or p_page<0 or p_page>100000 or p_pending_only is null or (p_status is not null and p_status not in ('enquiry','quoted','confirmed','checked_in','checked_out','cancelled','expired')) or p_arrival is null or p_departure is null or p_departure<=p_arrival or p_departure-p_arrival>365 or p_guests is null or p_guests not between 1 and 20 then raise exception 'Choose valid booking search, page and stay dates';end if;
 with scoped as (
   select b.*,coalesce(c.full_name,'Guest') guest_name,r.name room_name,t.name room_type,
     'HT-'||case when ref.number<1000000 then lpad(ref.number::text,6,'0') else ref.number::text end reference
   from hotel_booking_enquiries b join crm_customers c on c.organization_id=b.organization_id and c.id=b.customer_id
   left join hotel_rooms r on r.organization_id=b.organization_id and r.id=b.room_id
   left join hotel_room_types t on t.organization_id=r.organization_id and t.id=r.room_type_id
   left join hotel_booking_references ref on ref.organization_id=b.organization_id and ref.booking_id=b.id
   where b.organization_id=p_organization_id
     and (p_status is null or b.status=p_status)
     and (p_arrival_day is null or (b.arrival_date=p_arrival_day and b.status in ('confirmed','checked_in','checked_out')))
     and (p_departure_day is null or (b.departure_date=p_departure_day and b.status in ('checked_in','checked_out')))
     and (not p_pending_only or exists(select 1 from hotel_offline_payments p where p.organization_id=b.organization_id and p.booking_id=b.id and p.status='pending'))
     and (coalesce(trim(p_query),'')='' or position(lower(trim(p_query)) in lower(coalesce(c.full_name,'')||' '||coalesce(c.phone,'')||' '||coalesce(c.email,'')||' '||coalesce(r.name,'')||' '||coalesce(t.name,'')||' '||b.id::text||' HT-'||case when ref.number<1000000 then lpad(ref.number::text,6,'0') else ref.number::text end))>0)
 ), page_info as (select count(*) total,least(p_page,greatest((count(*)-1)/25,0))::integer page from scoped),
 inventory as (
   select r.id,r.name,r.room_type_id,r.active,
     r.active and t.capacity>=p_guests and not exists(select 1 from hotel_booking_enquiries b where b.organization_id=p_organization_id and b.room_id=r.id and b.status in ('confirmed','checked_in') and b.arrival_date<p_departure and b.departure_date>p_arrival) available
   from hotel_rooms r join hotel_room_types t on t.organization_id=r.organization_id and t.id=r.room_type_id where r.organization_id=p_organization_id
 ), grouped as (
   select t.id,t.name,t.capacity,t.nightly_rate_minor,t.currency,count(i.id) filter(where i.active)::integer active_rooms,count(i.id) filter(where i.available)::integer available_rooms
   from hotel_room_types t left join inventory i on i.room_type_id=t.id where t.organization_id=p_organization_id group by t.id
 ) select jsonb_build_object(
   'reservations',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id desc) from (select * from scoped order by created_at desc,id desc limit 25 offset (select page*25 from page_info))s),'[]'::jsonb),
   'pagination',(select jsonb_build_object('total',total,'page',page,'pageSize',25,'query',coalesce(trim(p_query),''),'status',p_status,'pendingOnly',p_pending_only) from page_info),
   'summary',(select jsonb_build_object('enquiries',count(*) filter(where status in ('enquiry','quoted')),'confirmed',count(*) filter(where status='confirmed'),'inHouse',count(*) filter(where status='checked_in')) from hotel_booking_enquiries where organization_id=p_organization_id),
   'rooms',coalesce((select jsonb_agg(to_jsonb(i)-'available' order by i.name,i.id) from inventory i),'[]'::jsonb),
   'availability',coalesce((select jsonb_agg(jsonb_build_object('room_id',id,'available',available) order by name,id) from inventory),'[]'::jsonb),
   'roomTypes',coalesce((select jsonb_agg(to_jsonb(g)-array['active_rooms','available_rooms'] order by name,id) from grouped g),'[]'::jsonb),
   'availabilityGroups',coalesce((select jsonb_agg(to_jsonb(g) order by name,id) from grouped g),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.hotel_workspace_page(uuid,text,text,date,date,integer,boolean,date,date,integer) from public,anon,authenticated;
grant execute on function public.hotel_workspace_page(uuid,text,text,date,date,integer,boolean,date,date,integer) to service_role;

-- Ordered media mutations lock the parent and compare its revision. Publication stays atomic.
create function public.hotel_catalog_order_media(p_organization_id uuid,p_item_id uuid,p_media_id uuid,p_action text,p_revision integer,p_actor uuid,p_caption text default null)
returns void language plpgsql security invoker set search_path=public as $$
declare item hotel_catalog_items;asset hotel_catalog_media;ids uuid[];target integer;current_position integer;temporary uuid;
begin
 if p_organization_id is null or p_item_id is null or p_media_id is null or p_revision is null or p_actor is null or p_action is null then raise exception 'Reload this draft before changing media';end if;
 select * into item from hotel_catalog_items where organization_id=p_organization_id and id=p_item_id for update;
 if not found or item.status<>'draft' or item.revision<>p_revision then raise exception 'This draft changed. Reload before changing media order';end if;
 select * into asset from hotel_catalog_media where organization_id=p_organization_id and item_id=p_item_id and id=p_media_id and status<>'removed';
 if not found then raise exception 'Ready media not found in this draft';end if;
 if p_action='caption' then
   if p_caption is null or length(p_caption)>200 then raise exception 'Use a caption of 200 characters or fewer';end if;
   update hotel_catalog_media set caption=p_caption where organization_id=p_organization_id and item_id=p_item_id and id=p_media_id;
   update hotel_catalog_items set updated_by=p_actor where organization_id=p_organization_id and id=p_item_id;return;
 end if;
 if asset.status<>'ready' then raise exception 'Finish verification before changing media order';end if;
 select array_agg(id order by position,created_at,id) into ids from hotel_catalog_media where organization_id=p_organization_id and item_id=p_item_id and status='ready';
 current_position:=array_position(ids,p_media_id);
 if p_action='cover' then
   if asset.mime_type not like 'image/%' then raise exception 'Choose an image as the cover';end if;
   ids:=array_prepend(p_media_id,array_remove(ids,p_media_id));
 elsif p_action in ('up','down') then
   target:=current_position+case when p_action='up' then -1 else 1 end;
   if target<1 or target>cardinality(ids) then return;end if;
   temporary:=ids[target];ids[target]:=p_media_id;ids[current_position]:=temporary;
 else raise exception 'Choose a valid media order action';end if;
 update hotel_catalog_media m set position=a.ordinality-1 from unnest(ids) with ordinality a(id,ordinality) where m.organization_id=p_organization_id and m.item_id=p_item_id and m.id=a.id;
 update hotel_catalog_items set updated_by=p_actor where organization_id=p_organization_id and id=p_item_id;
end $$;
revoke all on function public.hotel_catalog_order_media(uuid,uuid,uuid,text,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.hotel_catalog_order_media(uuid,uuid,uuid,text,integer,uuid,text) to service_role;
