import type { PropertyRecord } from "@/lib/limitless-data";

export class PropertyCampaignMessageError extends Error {
  constructor(message: string) { super(message); this.name = "PropertyCampaignMessageError"; }
}

function clean(value: unknown, max = 1800) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, max);
}

function safeMediaUrl(value: string) {
  const raw = clean(value, 2048);
  if (!raw) return "";
  let url: URL;
  try { url = new URL(raw); } catch { throw new PropertyCampaignMessageError("The campaign image URL is invalid."); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || !host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host === "::1" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new PropertyCampaignMessageError("Campaign media must use a public HTTPS URL; local and private hosts are not allowed.");
  }
  return url.toString();
}

export function buildPropertyCampaignContent(property: PropertyRecord, originalMessage: string, mediaUrl = "") {
  const title = clean(property?.title, 160);
  if (!title || !String(property?.id || "").trim()) throw new PropertyCampaignMessageError("Choose a verified property from this organization before preparing its campaign.");
  const status = clean(property.status, 48).toLowerCase();
  if (!status || !["active", "available", "published"].includes(status)) throw new PropertyCampaignMessageError("Only active or available property listings can be promoted.");
  const location = [clean(property.location_area, 120), clean(property.location_city, 120)].filter(Boolean).join(", ");
  const facts = [
    `Property: ${title}`,
    location ? `Location: ${location}` : "",
    clean(property.price, 100) ? `Price: ${clean(property.price, 100)}` : "",
    clean(property.type, 100) ? `Type: ${clean(property.type, 100)}` : "",
    clean(property.features, 500) ? `Features: ${clean(property.features, 500)}` : "",
    clean(property.description, 700) ? `Listing details: ${clean(property.description, 700)}` : "",
  ].filter(Boolean).join("\n");
  const supplied = clean(originalMessage, 3000).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const opening = supplied.shift() || `Here is a current listing you may be interested in: ${title}.`;
  const responsePrompt = supplied.length > 1 ? supplied.pop()! : "Reply MORE INFO if you would like an agent to verify current availability and arrange a viewing.";
  const supporting = [supplied.join("\n"), facts].filter(Boolean).join("\n");
  const message = [opening, supporting, responsePrompt].join("\n\n");
  if (message.length > 4000) throw new PropertyCampaignMessageError("The property campaign message is too long after verified listing details are added.");
  const media = safeMediaUrl(mediaUrl);
  const memory = {
    propertyId: property.id,
    propertyName: title,
    organizationId: property.organization_id || null,
    status,
    location: location || null,
    price: clean(property.price, 100) || null,
    type: clean(property.type, 100) || null,
    features: clean(property.features, 500) || null,
    description: clean(property.description, 700) || null,
  };
  return {
    message,
    propertyName: title,
    mediaUrl: media || null,
    memory,
    replyInstruction: `Answer property questions using only this verified listing snapshot: ${JSON.stringify(memory)}. Do not infer missing facts or promise continued availability; ask a human agent to re-verify availability and documents before booking.`,
  };
}
