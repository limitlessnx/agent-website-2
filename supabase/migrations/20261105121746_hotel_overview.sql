-- Prepared for review only: read-only, tenant-wide daily totals and availability.
create function public.hotel_overview_core(p_organization_id uuid,p_day date,p_arrival date,p_departure date,p_guests integer)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 if p_organization_id is null or p_day is null or p_arrival is null or p_departure is null or p_departure<=p_arrival or p_departure-p_arrival>365 or p_guests is null or p_guests not between 1 and 20 then raise exception 'Choose valid hotel dates and guest count'; end if;
 with stays as (
   select b.id,b.revision,b.status,b.arrival_date,b.departure_date,b.guest_count,coalesce(c.full_name,'Guest') guest_name,r.name room_name,t.name room_type
   from hotel_booking_enquiries b join crm_customers c on c.organization_id=b.organization_id and c.id=b.customer_id
   left join hotel_rooms r on r.organization_id=b.organization_id and r.id=b.room_id
   left join hotel_room_types t on t.organization_id=r.organization_id and t.id=r.room_type_id
   where b.organization_id=p_organization_id
 ), room_availability as (
   select t.id,t.name,t.capacity,t.nightly_rate_minor,t.currency,
     count(r.id)::integer active_rooms,
     count(r.id) filter(where t.capacity>=p_guests and not exists(
       select 1 from hotel_booking_enquiries b where b.organization_id=p_organization_id and b.room_id=r.id and b.status in ('confirmed','checked_in') and b.arrival_date<p_departure and b.departure_date>p_arrival
     ))::integer available_rooms
   from hotel_room_types t left join hotel_rooms r on r.organization_id=t.organization_id and r.room_type_id=t.id and r.active
   where t.organization_id=p_organization_id group by t.id
 ) select jsonb_build_object(
   'arrivals_count',(select count(*) from stays where arrival_date=p_day and status in ('confirmed','checked_in','checked_out')),
   'departures_count',(select count(*) from stays where departure_date=p_day and status in ('checked_in','checked_out')),
   'occupied_rooms',(select count(distinct b.room_id) from hotel_booking_enquiries b where b.organization_id=p_organization_id and b.status='checked_in' and b.room_id is not null),
   'active_rooms',(select count(*) from hotel_rooms where organization_id=p_organization_id and active),
   'enquiries_count',(select count(*) from stays where status in ('enquiry','quoted')),
   'overdue_departures',(select count(*) from stays where status='checked_in' and departure_date<p_day),
   'arrivals',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from stays where arrival_date=p_day and status in ('confirmed','checked_in','checked_out') order by guest_name,id limit 6)s),'[]'::jsonb),
   'departures',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from stays where departure_date=p_day and status in ('checked_in','checked_out') order by guest_name,id limit 6)s),'[]'::jsonb),
   'enquiries',coalesce((select jsonb_agg(to_jsonb(s)) from (select id,guest_name,status from stays where status in ('enquiry','quoted') order by id limit 3)s),'[]'::jsonb),
   'overdue_stays',coalesce((select jsonb_agg(to_jsonb(s)) from (select id,guest_name from stays where status='checked_in' and departure_date<p_day order by departure_date,id limit 3)s),'[]'::jsonb),
   'availability',coalesce((select jsonb_agg(to_jsonb(r) order by r.name,r.id) from room_availability r),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.hotel_overview_core(uuid,date,date,date,integer) from public,anon,authenticated;
grant execute on function public.hotel_overview_core(uuid,date,date,date,integer) to service_role;
create index hotel_booking_daily_arrivals on public.hotel_booking_enquiries(organization_id,arrival_date,status);
create index hotel_booking_daily_departures on public.hotel_booking_enquiries(organization_id,departure_date,status);
