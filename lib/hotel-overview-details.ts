import { createAdminClient } from "@/lib/supabase/admin";

export type HotelOverviewDetails = {
  name: string;
  recentBookings: Array<{ id: string; guest_name: string; status: string; arrival_date: string | null; departure_date: string | null }>;
  roomPhotos: Array<{ roomTypeId: string; url: string; caption: string }>;
};

/** Bounded, tenant-scoped presentation data. No balances, private notes or contacts. */
export async function loadHotelOverviewDetails(org: string, roomTypeIds: string[]): Promise<HotelOverviewDetails> {
  const admin = createAdminClient();
  const [organization, settings, bookings, items] = await Promise.all([
    admin.from("organizations").select("name").eq("id", org).maybeSingle(),
    admin.from("hotel_settings").select("values").eq("organization_id", org).maybeSingle(),
    admin.from("hotel_booking_enquiries").select("id,customer_id,status,arrival_date,departure_date").eq("organization_id", org).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(5),
    roomTypeIds.length ? admin.from("hotel_catalog_items").select("id,room_type_id").eq("organization_id", org).eq("kind", "room").eq("status", "published").in("room_type_id", roomTypeIds.slice(0, 6)).limit(6) : Promise.resolve({ data: [], error: null }),
  ]);
  if ([organization, settings, bookings, items].some(result => result.error)) throw new Error("Hotel details are unavailable.");
  const customerIds = [...new Set((bookings.data || []).map(row => row.customer_id))];
  const [customers, assets] = await Promise.all([
    customerIds.length ? admin.from("crm_customers").select("id,full_name").eq("organization_id", org).in("id", customerIds) : Promise.resolve({ data: [], error: null }),
    items.data?.length ? admin.from("hotel_catalog_media").select("item_id,storage_path,caption").eq("organization_id", org).eq("status", "ready").in("mime_type", ["image/jpeg", "image/png", "image/webp"]).in("item_id", items.data.map(row => row.id)).order("position").order("created_at").order("id").limit(72) : Promise.resolve({ data: [], error: null }),
  ]);
  if (customers.error || assets.error) throw new Error("Hotel details are unavailable.");
  const photos = await Promise.all((items.data || []).map(async item => {
    const asset = assets.data?.find(row => row.item_id === item.id);
    if (!asset) return null;
    const signed = await admin.storage.from("hotel-catalog").createSignedUrl(asset.storage_path, 900);
    if (signed.error || !signed.data?.signedUrl) throw new Error("Hotel photos are unavailable.");
    return { roomTypeId: String(item.room_type_id), url: signed.data.signedUrl, caption: String(asset.caption || "Room photo") };
  }));
  return {
    name: String(settings.data?.values?.business_name || organization.data?.name || "Your hotel"),
    recentBookings: (bookings.data || []).map(row => ({ id: String(row.id), guest_name: customers.data?.find(customer => customer.id === row.customer_id)?.full_name || "Guest", status: String(row.status), arrival_date: row.arrival_date, departure_date: row.departure_date })),
    roomPhotos: photos.filter((photo): photo is NonNullable<typeof photo> => photo !== null),
  };
}
