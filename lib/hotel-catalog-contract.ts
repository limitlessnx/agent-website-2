import type { HotelRoomType } from "./hotel-booking-contract";
export const HOTEL_CATALOG_BUCKET = "hotel-catalog";
export const HOTEL_MEDIA_LIMIT = 16 * 1024 * 1024;
export const HOTEL_IMAGE_LIMIT = 6 * 1024 * 1024;
export const HOTEL_MEDIA_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4" };
export type HotelCatalogItem = {
  id: string; kind: "room" | "service"; room_type_id: string | null; title: string; description: string;
  amenities: string[]; bed_options: string; pricing: "included" | "paid" | "confirm";
  price_minor: string | number | null; currency: string | null; price_unit: string;
  opening_hours: string; booking_instructions: string; status: "draft" | "published" | "archived"; revision: number;
};
export type HotelCatalogMedia = { id: string; item_id: string; mime_type: string; caption: string; status: "pending" | "ready" | "removed"; position: number; url?: string };
export type HotelCatalogData = { items: HotelCatalogItem[]; roomTypes: HotelRoomType[]; media: HotelCatalogMedia[]; canManage: boolean;mediaExpiresAt?:string };
export type HotelGuestCatalogPreview={entries:Array<{id:string;kind:string;title:string;description:string;amenities:string[];bed_options:string;capacity?:number;price:{mode:string;nightly?:string;stay_room_charge?:string|null;amount?:string|null;unit?:string};opening_hours:string;booking_instructions:string;media:Array<{kind:string;caption:string;url?:string}>}>;more_results:boolean};
export function catalogTitle(item: HotelCatalogItem, types: HotelRoomType[]) { return item.kind === "room" ? types.find(type => type.id === item.room_type_id)?.name || "Room type unavailable" : item.title; }
export function validateHotelMedia(type: string, size: number) {
  if (!HOTEL_MEDIA_TYPES[type]) throw new Error("Choose a JPG, PNG, WebP image or MP4 video.");
  if (!Number.isSafeInteger(size) || size < 1 || size > (type.startsWith("image/") ? HOTEL_IMAGE_LIMIT : HOTEL_MEDIA_LIMIT)) throw new Error("Images must be 6 MB or smaller; MP4 videos must be 16 MB or smaller.");
}
export function hotelMediaMatches(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png") return [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start,end));
  if (type === "image/webp") return ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP";
  if (type === "video/mp4") return ascii(4,8) === "ftyp" && ["isom","iso2","mp41","mp42","avc1","M4V "].includes(ascii(8,12));
  return false;
}
