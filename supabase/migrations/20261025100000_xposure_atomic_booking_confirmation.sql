-- Serialize Xposure booking confirmations per organization to prevent concurrent overlap confirmations.
create or replace function public.confirm_xposure_booking(p_organization_id uuid, p_booking_id uuid, p_actor_id uuid)
returns public.xposure_bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.xposure_bookings%rowtype;
  v_conflict_id uuid;
begin
  if p_organization_id is null or p_booking_id is null or p_actor_id is null then
    raise exception using errcode = '22023', message = 'organization, booking, and actor are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));
  select * into v_booking from public.xposure_bookings where organization_id = p_organization_id and id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking not found in Xposure'; end if;
  if v_booking.payment_status <> 'verified' then raise exception using errcode = 'P0001', message = 'Payment must be manually verified first'; end if;
  if v_booking.booking_status not in ('pending','awaiting_payment','payment_review') then raise exception using errcode = 'P0001', message = 'Booking is not active and unconfirmed'; end if;
  if v_booking.requested_start_at is null or v_booking.requested_end_at is null or v_booking.requested_end_at <= v_booking.requested_start_at then raise exception using errcode = 'P0001', message = 'A valid requested date and time are required'; end if;
  if v_booking.service_type in ('wedding','videography','custom') and coalesce(v_booking.service_details ->> 'staff_approved_quote', 'false') <> 'true' then raise exception using errcode = 'P0001', message = 'Staff-approved custom quote required'; end if;
  select id into v_conflict_id from public.xposure_bookings where organization_id = p_organization_id and booking_status = 'confirmed' and id <> p_booking_id and requested_start_at < v_booking.requested_end_at and requested_end_at > v_booking.requested_start_at limit 1;
  if v_conflict_id is not null then raise exception using errcode = '23P01', message = 'This time overlaps another confirmed booking'; end if;
  update public.xposure_bookings set booking_status = 'confirmed', confirmed_by = p_actor_id, confirmed_at = now(), follow_up_state = 'completed', updated_at = now() where organization_id = p_organization_id and id = p_booking_id returning * into v_booking;
  return v_booking;
end;
$$;
revoke all on function public.confirm_xposure_booking(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_xposure_booking(uuid, uuid, uuid) to service_role;
