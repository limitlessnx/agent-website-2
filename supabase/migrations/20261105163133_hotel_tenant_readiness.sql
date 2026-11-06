-- Pending review. Derive readiness independently for each hotel; never seed tenant content.
create function public.hotel_tenant_inventory_readiness(p_organization_id uuid) returns jsonb
language sql stable security invoker set search_path=public as $$
 with active_types as (
  select t.id from hotel_room_types t where t.organization_id=p_organization_id
   and exists(select 1 from hotel_rooms r where r.organization_id=t.organization_id and r.room_type_id=t.id and r.active)
 ), covered as (
  select t.id from active_types t where exists(select 1 from hotel_catalog_items c where c.organization_id=p_organization_id and c.room_type_id=t.id and c.kind='room' and c.status='published')
 ) select jsonb_build_object(
  'roomTypes',(select count(*) from hotel_room_types where organization_id=p_organization_id),
  'activeRooms',(select count(*) from hotel_rooms where organization_id=p_organization_id and active),
  'activeRoomTypes',(select count(*) from active_types),
  'publishedRoomTypes',(select count(*) from covered),
  'unpublishedRoomTypes',(select count(*) from active_types)-(select count(*) from covered),
  'publishedServices',(select count(*) from hotel_catalog_items where organization_id=p_organization_id and kind='service' and status='published')
 );
$$;
revoke all on function public.hotel_tenant_inventory_readiness(uuid) from public,anon,authenticated;
grant execute on function public.hotel_tenant_inventory_readiness(uuid) to service_role;
