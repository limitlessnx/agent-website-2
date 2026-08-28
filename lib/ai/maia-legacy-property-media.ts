import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchMaiaPropertyMedia } from "@/lib/ai/maia-property-media-dispatch";

export const LIMITLESS_REALTY_ORGANIZATION_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function mediaKind(mimeType: unknown, metadata: unknown) {
  const mime = text(mimeType).toLowerCase();
  const meta = record(metadata);
  const explicit = text(meta.media_type || meta.asset_type).toLowerCase();
  if (explicit) return explicit;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "document";
  return "file";
}

function approvedMedia(metadata: unknown) {
  const meta = record(metadata);
  return meta.approved !== false && meta.status !== "rejected" && meta.disabled !== true;
}

function parseConversationLog(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return [parsed];
  } catch {
    return [];
  }
  return [];
}

function entryRole(entry: unknown) {
  const row = record(entry);
  return text(row.role || row.sender_type || row.sender || row.direction || row.type).toLowerCase();
}

function entryTime(entry: unknown) {
  const row = record(entry);
  const raw = row.created_at || row.timestamp || row.time || row.sent_at || row.date || row.datetime;
  if (typeof raw === "number") {
    const millis = raw > 1e12 ? raw : raw * 1000;
    return Number.isFinite(millis) ? millis : NaN;
  }
  const parsed = Date.parse(text(raw));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function latestVerifiedInboundAt(log: unknown) {
  const customerRoles = new Set(["user", "customer", "inbound", "client", "lead", "human"]);
  let latest = NaN;
  for (const entry of parseConversationLog(log)) {
    if (!customerRoles.has(entryRole(entry))) continue;
    const timestamp = entryTime(entry);
    if (Number.isFinite(timestamp) && (!Number.isFinite(latest) || timestamp > latest)) latest = timestamp;
  }
  return latest;
}

function assertLimitlessOrganization(organizationId: string) {
  if (organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID) {
    throw new Error("Legacy property media bridge is restricted to Limitless Realty.");
  }
}

export async function searchLegacyMaiaProperties(args: { organizationId: string; query: string; limit?: number }) {
  assertLimitlessOrganization(args.organizationId);
  const query = text(args.query).slice(0, 160).replace(/[%_]/g, "");
  if (!query) return { match_status: "none", properties: [] };
  const admin = createAdminClient();
  const limit = Math.max(1, Math.min(10, Number(args.limit || 8)));
  const { data, error } = await admin
    .from("properties")
    .select("id,title,type,location_city,location_area,price,status,features,description,updated_at")
    .eq("organization_id", args.organizationId)
    .or(`title.ilike.%${query}%,location_city.ilike.%${query}%,location_area.ilike.%${query}%,type.ilike.%${query}%`)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  const properties = data || [];
  const normalized = query.toLowerCase();
  const exact = properties.filter((row) => text(row.title).toLowerCase() === normalized);
  const matchStatus = exact.length === 1 ? "exact" : properties.length === 0 ? "none" : properties.length === 1 ? "single_candidate" : "ambiguous";
  return {
    match_status: matchStatus,
    exact_property_id: exact.length === 1 ? exact[0].id : null,
    requires_disambiguation: matchStatus === "ambiguous",
    properties,
  };
}

export async function getLegacyMaiaPropertyMedia(args: { organizationId: string; propertyId: string; mediaType?: string; limit?: number }) {
  assertLimitlessOrganization(args.organizationId);
  const propertyId = text(args.propertyId);
  if (!propertyId) throw new Error("propertyId is required.");
  const requestedType = text(args.mediaType).toLowerCase() || "any";
  const admin = createAdminClient();
  const { data: property, error: propertyError } = await admin
    .from("properties")
    .select("id,title,type,location_city,location_area,status")
    .eq("organization_id", args.organizationId)
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) throw propertyError;
  if (!property) return { found: false, reason: "property_not_found_for_tenant", property_id: propertyId, assets: [] };

  const { data: media, error } = await admin
    .from("media_assets")
    .select("id,property_id,storage_bucket,storage_path,mime_type,file_name,caption,send_status,metadata,created_at")
    .eq("organization_id", args.organizationId)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(20, Number(args.limit || 12))));
  if (error) throw error;
  const assets = (media || [])
    .filter((asset) => approvedMedia(asset.metadata))
    .map((asset) => ({ ...asset, media_type: mediaKind(asset.mime_type, asset.metadata) }))
    .filter((asset) => requestedType === "any" || asset.media_type === requestedType || (requestedType === "brochure" && asset.media_type === "document"));
  return {
    found: true,
    property,
    assets,
    has_registered_media: assets.length > 0,
    warning: assets.length ? null : "No approved registered media is available for this property.",
  };
}

export async function sendLegacyMaiaPropertyMedia(args: { organizationId: string; leadId: string; assetId: string }) {
  assertLimitlessOrganization(args.organizationId);
  const leadId = text(args.leadId);
  const assetId = text(args.assetId);
  if (!leadId || !assetId) throw new Error("leadId and assetId are required.");
  const admin = createAdminClient();

  const { data: lead, error: leadError } = await admin
    .from("leads")
    .select("id,name,phone,conversation_log,updated_at")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) throw leadError;
  if (!lead || !text(lead.phone)) throw new Error("The verified legacy lead or WhatsApp phone could not be found.");

  const inboundAt = latestVerifiedInboundAt(lead.conversation_log);
  if (!Number.isFinite(inboundAt)) throw new Error("No timestamped customer inbound message could be verified in the legacy conversation log.");
  if (Date.now() - inboundAt >= 24 * 60 * 60 * 1000 || inboundAt > Date.now() + 5 * 60 * 1000) {
    throw new Error("The WhatsApp customer-service window is closed or could not be verified. Direct property media was not sent.");
  }

  const { data: asset, error: assetError } = await admin
    .from("media_assets")
    .select("id,organization_id,property_id,storage_bucket,storage_path,mime_type,file_name,caption,metadata")
    .eq("id", assetId)
    .eq("organization_id", args.organizationId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset || !asset.property_id) throw new Error("The requested asset is not registered to a Limitless Realty property.");
  if (!approvedMedia(asset.metadata)) throw new Error("The requested property media asset is not approved for customer delivery.");

  const kind = mediaKind(asset.mime_type, asset.metadata);
  if (!["image", "video", "document"].includes(kind)) throw new Error(`Unsupported WhatsApp media type: ${kind}.`);

  const { data: property, error: propertyError } = await admin
    .from("properties")
    .select("id,title,location_city,location_area,status")
    .eq("id", asset.property_id)
    .eq("organization_id", args.organizationId)
    .maybeSingle();
  if (propertyError) throw propertyError;
  if (!property) throw new Error("The requested media does not belong to a Limitless Realty property.");

  const metadata = record(asset.metadata);
  let publicUrl = text(metadata.public_url);
  if (!publicUrl && asset.storage_bucket && asset.storage_path) {
    const resolved = admin.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path);
    publicUrl = text(resolved.data?.publicUrl);
  }
  if (!publicUrl) throw new Error("The approved media asset has no deliverable URL.");

  const result = await dispatchMaiaPropertyMedia({
    commandId: `maia-legacy-property-media:${lead.id}:${asset.id}:${randomUUID()}`,
    recipient: text(lead.phone),
    propertyId: String(property.id),
    propertyTitle: text(property.title) || "Property",
    assetId: String(asset.id),
    mediaUrl: publicUrl,
    mediaType: kind as "image" | "video" | "document",
    mimeType: text(asset.mime_type),
    fileName: text(asset.file_name),
    caption: text(asset.caption) || text(property.title) || "Property media",
  });

  return {
    ...result,
    lead_id: lead.id,
    property_title: property.title,
    last_customer_message_at: new Date(inboundAt).toISOString(),
    recipient_verified: true,
    source: "legacy_limitless_whatsapp_bridge",
  };
}
