-- Read-only hotel trends. No payment collection, dispatch or live automation changes.
create function public.hotel_dashboard_trends(p_organization_id uuid,p_day date,p_timezone text,p_include_payments boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare activity jsonb; revenue jsonb := null; start_at timestamptz; finish_at timestamptz;
begin
 if p_organization_id is null or p_day is null or p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
   raise exception 'Choose a valid hotel, local day and timezone';
 end if;
 start_at := (p_day-13)::timestamp at time zone p_timezone;
 finish_at := (p_day+1)::timestamp at time zone p_timezone;
 with days as (select p_day-13+n as day from generate_series(0,13) n),
 bookings as (
   select (created_at at time zone p_timezone)::date as day,count(*) as total
   from public.hotel_booking_enquiries where organization_id=p_organization_id and created_at>=start_at and created_at<finish_at group by 1
 ), first_checkin as (
   select booking_id,min(created_at) as checked_at from public.hotel_booking_events
   where organization_id=p_organization_id and event_type in ('reservation_created','reservation_updated') and details->>'status'='checked_in'
   group by booking_id
 ), checkins as (
   select (checked_at at time zone p_timezone)::date as day,count(*) as total from first_checkin
   where checked_at>=start_at and checked_at<finish_at group by 1
 ) select jsonb_agg(jsonb_build_object('day',d.day,'bookings',coalesce(b.total,0),'checkins',coalesce(c.total,0)) order by d.day)
 into activity from days d left join bookings b using(day) left join checkins c using(day);

 -- Separate branch: no payment rows are read when the caller lacks finance permission.
 if coalesce(p_include_payments,false) then
   with days as (select p_day-13+n as day from generate_series(0,13) n),
   payments as (
     select currency,(verified_at at time zone p_timezone)::date as day,sum(amount_minor) as total
     from public.hotel_offline_payments
     where organization_id=p_organization_id and status='verified' and verified_at>=start_at and verified_at<finish_at
     group by 1,2
   ), currencies as (
     select currency from payments
     union select values->>'currency' from public.hotel_settings where organization_id=p_organization_id and values->>'currency' ~ '^[A-Z]{3}$'
   ), series as (
     select c.currency,jsonb_agg(jsonb_build_object('day',d.day,'amount_minor',coalesce(p.total,0)::text) order by d.day) as points
     from currencies c cross join days d left join payments p on p.currency=c.currency and p.day=d.day group by c.currency
   ) select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'points',points) order by currency),'[]'::jsonb) into revenue from series;
 end if;
 return jsonb_build_object('daily',coalesce(activity,'[]'::jsonb),'revenue',revenue);
end $$;
revoke all on function public.hotel_dashboard_trends(uuid,date,text,boolean) from public,anon,authenticated;
grant execute on function public.hotel_dashboard_trends(uuid,date,text,boolean) to service_role;
create index hotel_verified_revenue_daily on public.hotel_offline_payments(organization_id,verified_at,currency) where status='verified';
create index hotel_booking_created_daily on public.hotel_booking_enquiries(organization_id,created_at);
create index hotel_first_checkin_events on public.hotel_booking_events(organization_id,booking_id,created_at)
 where event_type in ('reservation_created','reservation_updated') and details->>'status'='checked_in';

-- Permission-checked server callers only; no synthetic unread counts or cross-tenant joins.
create function public.hotel_conversation_index(p_organization_id uuid,p_query text default '',p_status text default '',p_page integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_organization_id is null or p_query is null or length(p_query)>120 or p_status is null or length(p_status)>40 or p_page is null or p_page<0 or p_page>100000 then raise exception 'Choose a valid conversation filter';end if;
 with matches as (
   select v.id,v.customer_id,v.channel,v.status,v.updated_at,v.metadata->>'ai_response_mode' as ai_mode,coalesce(c.full_name,'Guest') as guest_name
   from public.crm_conversations v left join public.crm_customers c on c.organization_id=v.organization_id and c.id=v.customer_id
   where v.organization_id=p_organization_id and (p_status='' or v.status=p_status)
     and (trim(p_query)='' or position(lower(trim(p_query)) in lower(coalesce(c.full_name,'')))>0)
 ), page_rows as (select * from matches order by updated_at desc nulls last,id desc limit 25 offset p_page*25),
 previews as (
   select r.*,left(coalesce(m.content,''),180) as preview from page_rows r left join lateral (
     select content from public.crm_messages where organization_id=p_organization_id and conversation_id=r.id and direction in ('inbound','outbound') order by created_at desc,id desc limit 1
   ) m on true
 ) select jsonb_build_object('total',(select count(*) from matches),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.updated_at desc nulls last,p.id desc) from previews p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.hotel_conversation_index(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.hotel_conversation_index(uuid,text,text,integer) to service_role;
