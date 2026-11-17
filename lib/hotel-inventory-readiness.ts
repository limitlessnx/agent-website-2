import { createAdminClient } from "@/lib/supabase/admin";
import type { HotelInventoryReadiness } from "@/lib/hotel-setup-contract";

type Room = { room_type_id: string; active: boolean };
type CatalogItem = { room_type_id: string | null; kind: string; status: string };
export function summarizeHotelInventory(types: { id: string }[], rooms: Room[], catalog: CatalogItem[]): HotelInventoryReadiness {
  const activeRooms = rooms.filter(room => room.active);
  const occupiedTypes = new Set(activeRooms.map(room => room.room_type_id));
  const activeTypes = new Set(types.filter(type => occupiedTypes.has(type.id)).map(type => type.id));
  const covered = new Set(catalog.filter(item => item.kind === "room" && item.status === "published" && item.room_type_id && activeTypes.has(item.room_type_id)).map(item => item.room_type_id));
  return { roomTypes: types.length, activeRooms: activeRooms.length, activeRoomTypes: activeTypes.size, publishedRoomTypes: covered.size, unpublishedRoomTypes: activeTypes.size - covered.size, publishedServices: catalog.filter(item => item.kind === "service" && item.status === "published").length };
}

/** Authorized callers retain their existing access checks. No writes or provider calls. */
export async function getHotelInventoryReadiness(organizationId: string, admin = createAdminClient()): Promise<HotelInventoryReadiness> {
  const rpc = await admin.rpc("hotel_tenant_inventory_readiness", { p_organization_id: organizationId });
  if (!rpc.error) return rpc.data as HotelInventoryReadiness;
  // Missing-function compatibility only. Never bypass a permission or database error.
  if (!["PGRST202", "42883"].includes(rpc.error.code)) throw new Error("Hotel inventory readiness could not be loaded.");
  async function rows<T>(table: string, fields: string): Promise<T[]> {
    const all: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await admin.from(table).select(fields).eq("organization_id", organizationId).order("id").range(offset, offset + 999);
      if (result.error) throw new Error("Hotel inventory readiness could not be loaded.");
      const page = (result.data || []) as unknown as T[];
      all.push(...page);
      if (page.length < 1000) return all;
    }
  }
  const [types, rooms, catalog] = await Promise.all([
    rows<{ id: string }>("hotel_room_types", "id"),
    rows<Room>("hotel_rooms", "id,room_type_id,active"),
    rows<CatalogItem>("hotel_catalog_items", "id,room_type_id,kind,status"),
  ]);
  return summarizeHotelInventory(types, rooms, catalog);
}
