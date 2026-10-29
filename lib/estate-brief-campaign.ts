import type { PropertyRecord } from "@/lib/limitless-data";

export const ESTATE_BRIEF_TEMPLATE_NAME = "estate_brief_update";
export const ESTATE_BRIEF_CAMPAIGN_TYPE = "estate_brief_update";
export const ESTATE_BRIEF_VARIABLE_KEYS = [
  "customer_name",
  "property_name",
  "property_location",
  "property_price",
  "selling_point",
] as const;

export class EstateBriefCampaignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EstateBriefCampaignError";
  }
}

function clean(value: unknown, max = 1024) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, max);
}

export function requirePublicHttpsImageUrl(value: unknown) {
  const raw = clean(value, 2048);
  if (!raw) throw new EstateBriefCampaignError("Select a property with a direct public image URL before preparing this campaign.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new EstateBriefCampaignError("The estate campaign image URL is invalid."); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || !host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host === "::1" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new EstateBriefCampaignError("The estate campaign image must be a direct public HTTPS URL; Google Drive folders, local URLs and private hosts are not allowed.");
  }
  return url.toString();
}

export function buildEstateBriefCampaign(property: PropertyRecord, sellingPoint: string) {
  const propertyName = clean(property.title, 160);
  const location = [clean(property.location_area, 120), clean(property.location_city, 120)].filter(Boolean).join(", ");
  const price = clean(property.price, 120);
  const offer = clean(sellingPoint, 600);
  if (!propertyName || !property.id) throw new EstateBriefCampaignError("Choose a verified property before preparing an estate brief campaign.");
  if (!location) throw new EstateBriefCampaignError("The selected property needs a location before preparing an estate brief campaign.");
  if (!price) throw new EstateBriefCampaignError("The selected property needs a price before preparing an estate brief campaign.");
  if (!offer) throw new EstateBriefCampaignError("Add the campaign-specific selling point or offer for {{5}}.");
  const imageUrl = requirePublicHttpsImageUrl(property.drive_photos_link);
  return {
    propertyName,
    location,
    price,
    sellingPoint: offer,
    imageUrl,
    memory: { propertyId: property.id, propertyName, location, price, sellingPoint: offer, imageUrl },
  };
}
