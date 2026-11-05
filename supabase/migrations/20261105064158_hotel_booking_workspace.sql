-- Prepared for review only. Adds reservations and a manually verified offline ledger.
create table public.hotel_room_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 80),
  capacity integer not null check(capacity between 1 and 20),
  nightly_rate_minor bigint not null check(nightly_rate_minor between 0 and 1000000000000),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,name)
);
create table public.hotel_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_type_id uuid not null,
  name text not null check(length(trim(name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,name),
  foreign key(organization_id,room_type_id) references public.hotel_room_types(organization_id,id)
);
alter table public.hotel_booking_enquiries
  add column room_id uuid,
  add column guest_count integer not null default 1 check(guest_count between 1 and 20),
  add column nightly_rate_minor bigint check(nightly_rate_minor between 0 and 1000000000000),
  add column currency text check(currency ~ '^[A-Z]{3}$'),
  add column notes text not null default '' check(length(notes)<=2000),
  add column source_request_id uuid,
  add column request_fingerprint text,
  add constraint hotel_booking_room_fk foreign key(organization_id,room_id) references public.hotel_rooms(organization_id,id),
  add constraint hotel_booking_request_unique unique(organization_id,source_request_id);
create index hotel_reservation_overlap_idx on public.hotel_booking_enquiries(organization_id,room_id,arrival_date,departure_date) where status in ('confirmed','checked_in');
-- The exclusion constraint also protects against concurrent writers at stronger isolation levels.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
do $$ declare extension_schema text; begin
  select n.nspname into extension_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='btree_gist';
  execute format('alter table public.hotel_booking_enquiries add constraint hotel_room_no_overlap exclude using gist (organization_id %I.gist_uuid_ops with =,room_id %I.gist_uuid_ops with =,daterange(arrival_date,departure_date,''[)'') with &&) where (status in (''confirmed'',''checked_in''))',extension_schema,extension_schema);
end $$;
create index hotel_followups_booking_idx on public.hotel_followups(organization_id,booking_id,customer_id);

create table public.hotel_offline_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid not null, customer_id uuid not null,
  amount_minor bigint not null check(amount_minor between 1 and 1000000000000),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  method text not null check(method in ('cash','bank_transfer','pos','other')),
  reference text not null default '' check(length(reference)<=180),
  note text not null default '' check(length(note)<=1000),
  status text not null default 'pending' check(status in ('pending','verified','rejected','voided')),
  recorded_by uuid not null, verified_by uuid, verified_at timestamptz,
  verification_note text not null default '' check(length(verification_note)<=1000),
  void_reason text not null default '' check(length(void_reason)<=1000),
  review_history jsonb not null default '[]'::jsonb check(jsonb_typeof(review_history)='array'),
  voided_by uuid, voided_at timestamptz,
  request_id uuid not null, request_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique(organization_id,request_id),
  foreign key(organization_id,booking_id,customer_id) references public.hotel_booking_enquiries(organization_id,id,customer_id)
);
create index hotel_offline_payments_booking_idx on public.hotel_offline_payments(organization_id,booking_id,customer_id);
create table public.hotel_booking_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid not null, customer_id uuid not null,
  event_type text not null, actor_id uuid, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key(organization_id,booking_id,customer_id) references public.hotel_booking_enquiries(organization_id,id,customer_id)
);
create index hotel_booking_events_booking_idx on public.hotel_booking_events(organization_id,booking_id,created_at desc);

alter table public.hotel_room_types enable row level security;
alter table public.hotel_rooms enable row level security;
alter table public.hotel_offline_payments enable row level security;
alter table public.hotel_booking_events enable row level security;
revoke all on public.hotel_room_types,public.hotel_rooms,public.hotel_offline_payments,public.hotel_booking_events from public,anon,authenticated;
grant select on public.hotel_room_types,public.hotel_rooms,public.hotel_offline_payments,public.hotel_booking_events to authenticated;
grant all on public.hotel_room_types,public.hotel_rooms,public.hotel_offline_payments,public.hotel_booking_events to service_role;
create policy hotel_room_types_read on public.hotel_room_types for select to authenticated using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
create policy hotel_rooms_read on public.hotel_rooms for select to authenticated using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
create policy hotel_booking_events_read on public.hotel_booking_events for select to authenticated using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
create policy hotel_offline_payments_read on public.hotel_offline_payments for select to authenticated using(public.has_organization_permission(organization_id,'billing.view') or public.has_organization_permission(organization_id,'billing.manage'));

create function public.hotel_reservation_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare capacity integer; rate bigint; room_currency text; room_active boolean;
begin
  if tg_op='UPDATE' then
    if (new.source_request_id,new.request_fingerprint) is distinct from (old.source_request_id,old.request_fingerprint) then raise exception 'Reservation request identity is immutable'; end if;
    if new.status<>old.status and not (
      (old.status='enquiry' and new.status in ('quoted','confirmed','cancelled','expired')) or
      (old.status='quoted' and new.status in ('confirmed','cancelled','expired')) or
      (old.status='confirmed' and new.status in ('checked_in','cancelled')) or
      (old.status='checked_in' and new.status='checked_out')
    ) then raise exception 'This booking state transition is not allowed'; end if;
    if old.status in ('checked_out','cancelled','expired') and (new.room_id,new.arrival_date,new.departure_date,new.guest_count,new.nightly_rate_minor,new.currency) is distinct from (old.room_id,old.arrival_date,old.departure_date,old.guest_count,old.nightly_rate_minor,old.currency) then raise exception 'Closed reservation stay details cannot be edited'; end if;
  end if;
  if new.arrival_date is not null and new.departure_date is not null and (new.departure_date<=new.arrival_date or new.departure_date-new.arrival_date>365) then raise exception 'A stay must be between 1 and 365 nights'; end if;
  if new.room_id is not null then
    -- Serializes every allocation of this physical room, including concurrent inserts.
    perform 1 from public.hotel_rooms r where r.organization_id=new.organization_id and r.id=new.room_id for update;
    if not found then raise exception 'Room is unavailable in this organization'; end if;
    select t.capacity,t.nightly_rate_minor,t.currency,r.active into capacity,rate,room_currency,room_active from public.hotel_rooms r join public.hotel_room_types t on t.organization_id=r.organization_id and t.id=r.room_type_id where r.organization_id=new.organization_id and r.id=new.room_id;
    if new.guest_count>capacity then raise exception 'Guest count exceeds room capacity'; end if;
    new.nightly_rate_minor:=coalesce(new.nightly_rate_minor,rate);
    new.currency:=room_currency;
  end if;
  if new.status in ('confirmed','checked_in') then
    if new.room_id is null or new.arrival_date is null or new.departure_date is null then raise exception 'Choose a room and stay dates before confirming'; end if;
    if not room_active then raise exception 'This room is inactive'; end if;
    if exists(select 1 from public.hotel_booking_enquiries b where b.organization_id=new.organization_id and b.room_id=new.room_id and b.id<>new.id and b.status in ('confirmed','checked_in') and b.arrival_date<new.departure_date and b.departure_date>new.arrival_date) then raise exception 'This room is already reserved for the selected dates'; end if;
  end if;
  if new.arrival_date is not null and new.departure_date is not null and new.nightly_rate_minor is not null and new.nightly_rate_minor*(new.departure_date-new.arrival_date)>1000000000000 then raise exception 'Quoted room charge is too large'; end if;
  if tg_op='UPDATE' and new.currency is distinct from old.currency and exists(select 1 from public.hotel_offline_payments p where p.organization_id=old.organization_id and p.booking_id=old.id and p.status in ('pending','verified')) then raise exception 'Resolve existing payment records before changing currency'; end if;
  return new;
end $$;
create trigger hotel_z_reservation_guard before insert or update on public.hotel_booking_enquiries for each row execute function public.hotel_reservation_guard();

create or replace function public.hotel_booking_revision_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.organization_id,new.customer_id,new.id) is distinct from (old.organization_id,old.customer_id,old.id) then raise exception 'Booking identity is immutable'; end if;
  new.revision:=old.revision;
  if (new.status,new.arrival_date,new.departure_date,new.room_id,new.guest_count,new.nightly_rate_minor,new.currency,new.notes) is distinct from (old.status,old.arrival_date,old.departure_date,old.room_id,old.guest_count,old.nightly_rate_minor,old.currency,old.notes) then
    new.revision:=old.revision+1;
    update public.hotel_followups set status='cancelled',stop_reason='booking_changed' where organization_id=old.organization_id and booking_id=old.id and status in ('pending','processing');
  end if;
  return new;
end $$;

create function public.hotel_room_update_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.id,new.organization_id,new.room_type_id) is distinct from (old.id,old.organization_id,old.room_type_id) then raise exception 'Room identity and type are immutable'; end if;
  if old.active and not new.active and exists(select 1 from public.hotel_booking_enquiries b where b.organization_id=old.organization_id and b.room_id=old.id and b.status in ('confirmed','checked_in')) then raise exception 'Resolve active reservations before deactivating this room'; end if;
  return new;
end $$;
create trigger hotel_room_update before update on public.hotel_rooms for each row execute function public.hotel_room_update_guard();

create function public.hotel_booking_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.hotel_booking_events(organization_id,booking_id,customer_id,event_type,actor_id,details)
  values(new.organization_id,new.id,new.customer_id,case when tg_op='INSERT' then 'reservation_created' else 'reservation_updated' end,new.updated_by,jsonb_build_object('status',new.status,'revision',new.revision,'room_id',new.room_id,'arrival_date',new.arrival_date,'departure_date',new.departure_date,'guest_count',new.guest_count,'nightly_rate_minor',new.nightly_rate_minor,'currency',new.currency));
  return new;
end $$;
create trigger hotel_booking_audit after insert or update on public.hotel_booking_enquiries for each row execute function public.hotel_booking_audit();

create function public.hotel_offline_payment_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare booking_currency text;
begin
  select b.currency into booking_currency from public.hotel_booking_enquiries b where b.organization_id=new.organization_id and b.id=new.booking_id and b.customer_id=new.customer_id for update;
  if not found or booking_currency is null or new.currency<>booking_currency then raise exception 'Payment currency must match the reservation quote'; end if;
  if tg_op='INSERT' then
    if new.status<>'pending' or new.verified_by is not null or new.verified_at is not null or new.voided_by is not null or new.voided_at is not null then raise exception 'New offline records must await manual verification'; end if;
    new.review_history:='[]'::jsonb;
    new.verification_note:=''; new.void_reason:='';
  else
    if (new.id,new.organization_id,new.booking_id,new.customer_id,new.amount_minor,new.currency,new.method,new.reference,new.note,new.recorded_by,new.request_id,new.request_fingerprint,new.created_at) is distinct from (old.id,old.organization_id,old.booking_id,old.customer_id,old.amount_minor,old.currency,old.method,old.reference,old.note,old.recorded_by,old.request_id,old.request_fingerprint,old.created_at) then raise exception 'Original payment details are immutable; reject or void the record instead'; end if;
    if old.status='pending' and new.status in ('verified','rejected') then
      if new.verified_by is null then raise exception 'An authorized verifying manager is required'; end if;
      if new.status='rejected' and length(trim(new.verification_note))=0 then raise exception 'A reason is required when rejecting a record'; end if;
      new.verified_at:=now();
    elsif old.status='verified' and new.status='voided' then
      if new.voided_by is null or length(trim(new.void_reason))=0 then raise exception 'A manager and reason are required to void a record'; end if;
      new.verified_by:=old.verified_by; new.verified_at:=old.verified_at; new.verification_note:=old.verification_note; new.voided_at:=now();
    else raise exception 'This payment verification transition is not allowed'; end if;
    new.review_history:=old.review_history||jsonb_build_array(jsonb_build_object('status',new.status,'actor_id',coalesce(new.voided_by,new.verified_by),'note',case when new.status='voided' then new.void_reason else new.verification_note end,'at',now()));
  end if;
  return new;
end $$;
create trigger hotel_offline_payment_guard before insert or update on public.hotel_offline_payments for each row execute function public.hotel_offline_payment_guard();
create function public.hotel_payment_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.hotel_booking_events(organization_id,booking_id,customer_id,event_type,actor_id,details)
  values(new.organization_id,new.booking_id,new.customer_id,'payment_'||new.status,coalesce(new.voided_by,new.verified_by,new.recorded_by),jsonb_build_object('payment_id',new.id,'status',new.status));
  return new;
end $$;
create trigger hotel_payment_audit after insert or update on public.hotel_offline_payments for each row execute function public.hotel_payment_audit();

create function public.hotel_room_availability(p_organization_id uuid,p_arrival date,p_departure date,p_guests integer default 1)
returns table(room_id uuid,available boolean) language plpgsql stable security invoker set search_path='' as $$
begin
  if p_arrival is null or p_departure is null or p_departure<=p_arrival or p_departure-p_arrival>365 or p_guests is null or p_guests not between 1 and 20 then raise exception 'Choose valid stay dates and guest count'; end if;
  return query select r.id,r.active and t.capacity>=p_guests and not exists(select 1 from public.hotel_booking_enquiries b where b.organization_id=p_organization_id and b.room_id=r.id and b.status in ('confirmed','checked_in') and b.arrival_date<p_departure and b.departure_date>p_arrival) from public.hotel_rooms r join public.hotel_room_types t on t.organization_id=r.organization_id and t.id=r.room_type_id where r.organization_id=p_organization_id order by r.name;
end $$;
create function public.hotel_booking_payment_totals(p_organization_id uuid,p_booking_ids uuid[])
returns table(booking_id uuid,verified_minor text,pending_minor text) language sql stable security invoker set search_path='' as $$
  select b.id,coalesce(sum(p.amount_minor) filter(where p.status='verified'),0)::text,coalesce(sum(p.amount_minor) filter(where p.status='pending'),0)::text
  from public.hotel_booking_enquiries b left join public.hotel_offline_payments p on p.organization_id=b.organization_id and p.booking_id=b.id
  where b.organization_id=p_organization_id and b.id=any(p_booking_ids) group by b.id
$$;
revoke all on function public.hotel_reservation_guard(),public.hotel_room_update_guard(),public.hotel_booking_audit(),public.hotel_offline_payment_guard(),public.hotel_payment_audit(),public.hotel_room_availability(uuid,date,date,integer),public.hotel_booking_payment_totals(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.hotel_room_availability(uuid,date,date,integer),public.hotel_booking_payment_totals(uuid,uuid[]) to service_role;
