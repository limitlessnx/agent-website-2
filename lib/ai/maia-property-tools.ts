import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchMaiaPropertyMedia } from "@/lib/ai/maia-property-media-dispatch";

export type MaiaPropertyToolContext = {
  organizationId: string;
  agentId: string;
  sessionId: string;
};

export type MaiaPropertyToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (input: Record<string, unknown>, ctx: MaiaPropertyToolContext) => Promise<unknown>;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const uuidLike = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function mediaKind(mimeType: unknown, metadata: unknown) {
  const mime = text(mimeType).toLowerCase();
  const meta = object(metadata);
  const explicit = text(meta.media_type || meta.asset_type).toLowerCase();
  if (explicit) return explicit;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "document";
  return "file";
}

function approvedMedia(metadata: unknown) {
  const meta = object(metadata);
  if (meta.approved === false || meta.status === "rejected" || meta.disabled === true) return false;
  return true;
}

async function resolveTrustedWhatsAppRecipient(ctx: MaiaPropertyToolContext) {
  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("agent_runtime_sessions")
    .select("id,organization_id,agent_id,channel,external_conversation_id")
    .eq("id", ctx.sessionId)
    .eq("organization_id", ctx.organizationId)
    .eq("agent_id", ctx.agentId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) throw new Error("The Maia runtime session could not be verified.");
  if (text(session.channel).toLowerCase() !== "whatsapp") throw new Error("Property media can only be sent from a verified WhatsApp runtime session.");

  const externalId = text(session.external_conversation_id);
  if (!externalId) throw new Error("The WhatsApp session is not linked to a verified CRM conversation.");

  let conversation: any = null;
  if (uuidLike(externalId)) {
    const byId = await admin
      .from("agent_conversations")
      .select("id,organization_id,agent_id,customer_id,channel,external_thread_key")
      .eq("id", externalId)
      .eq("organization_id", ctx.organizationId)
      .eq("agent_id", ctx.agentId)
      .maybeSingle();
    if (byId.error) throw byId.error;
    conversation = byId.data;
  }
  if (!conversation) {
    const byThread = await admin
      .from("agent_conversations")
      .select("id,organization_id,agent_id,customer_id,channel,external_thread_key")
      .eq("external_thread_key", externalId)
      .eq("organization_id", ctx.organizationId)
      .eq("agent_id", ctx.agentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byThread.error) throw byThread.error;
    conversation = byThread.data;
  }
  if (!conversation || !conversation.customer_id) throw new Error("No verified customer is attached to this WhatsApp conversation.");
  if (text(conversation.channel).toLowerCase() !== "whatsapp") throw new Error("The linked CRM conversation is not a WhatsApp conversation.");

  const { data: customer, error: customerError } = await admin
    .from("crm_customers")
    .select("id,full_name,phone")
    .eq("id", conversation.customer_id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer || !text(customer.phone)) throw new Error("The verified WhatsApp customer has no phone number.");

  const { data: lastInbound, error: inboundError } = await admin
    .from("conversation_messages")
    .select("created_at")
    .eq("organization_id", ctx.organizationId)
    .eq("conversation_id", conversation.id)
    .eq("sender_type", "customer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (inboundError) throw inboundError;
  if (!lastInbound?.created_at) throw new Error("No verified customer inbound message exists for this conversation.");
  const inboundAt = new Date(lastInbound.created_at).getTime();
  if (!Number.isFinite(inboundAt) || Date.now() - inboundAt >= 24 * 60 * 60 * 1000) {
    throw new Error("The WhatsApp customer-service window is closed. Direct property media was not sent.");
  }

  return {
    conversationId: String(conversation.id),
    customerId: String(customer.id),
    customerName: text(customer.full_name) || "Customer",
    phone: text(customer.phone),
    lastInboundAt: String(lastInbound.created_at),
  };
}

export function maiaPropertyTools(): MaiaPropertyToolDefinition[] {
  return [
    {
      name: "search_properties",
      description: "Search this tenant's property catalog. Use this before answering about a named property or requesting property media. Return exact property IDs and do not guess between ambiguous matches.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["query"],
      },
      execute: async (input, ctx) => {
        const query = text(input.query).slice(0, 160).replace(/[%_]/g, "");
        if (!query) return { match_status: "none", properties: [] };
        const limit = Math.max(1, Math.min(10, Number(input.limit || 8)));
        const admin = createAdminClient();
        const { data, error } = await admin
          .from("properties")
          .select("id,title,type,location_city,location_area,price,status,features,description,cover_image_url,drive_photos_link,drive_brochure_link,updated_at")
          .eq("organization_id", ctx.organizationId)
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
      },
    },
    {
      name: "get_property_media",
      description: "Get approved media for one exact property ID belonging to this tenant. Never call this with a guessed property ID. Returns registered assets plus verified catalog links for that exact property only.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          propertyId: { type: "string" },
          mediaType: { type: "string", enum: ["any", "image", "video", "document", "brochure", "map", "survey_plan", "floor_plan", "virtual_tour"] },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["propertyId"],
      },
      execute: async (input, ctx) => {
        const propertyId = text(input.propertyId);
        if (!propertyId) throw new Error("propertyId is required.");
        const requestedType = text(input.mediaType).toLowerCase() || "any";
        const limit = Math.max(1, Math.min(20, Number(input.limit || 12)));
        const admin = createAdminClient();
        const { data: property, error: propertyError } = await admin
          .from("properties")
          .select("id,title,type,location_city,location_area,status,cover_image_url,image_urls,drive_photos_link,drive_brochure_link")
          .eq("organization_id", ctx.organizationId)
          .eq("id", propertyId)
          .maybeSingle();
        if (propertyError) throw propertyError;
        if (!property) return { found: false, reason: "property_not_found_for_tenant", property_id: propertyId, assets: [] };

        const { data: registered, error: mediaError } = await admin
          .from("media_assets")
          .select("id,property_id,storage_bucket,storage_path,mime_type,file_name,caption,send_status,metadata,created_at")
          .eq("organization_id", ctx.organizationId)
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (mediaError) throw mediaError;

        const assets = (registered || [])
          .filter((asset) => approvedMedia(asset.metadata))
          .map((asset) => ({ ...asset, media_type: mediaKind(asset.mime_type, asset.metadata) }))
          .filter((asset) => requestedType === "any" || asset.media_type === requestedType || (requestedType === "brochure" && asset.media_type === "document"));

        const imageUrls = Array.isArray(property.image_urls) ? property.image_urls.map(String).filter(Boolean) : [];
        const catalogLinks = [
          ...(property.cover_image_url ? [{ media_type: "image", source: "cover_image_url", url: property.cover_image_url }] : []),
          ...imageUrls.map((url) => ({ media_type: "image", source: "image_urls", url })),
          ...(property.drive_photos_link ? [{ media_type: "image_or_gallery", source: "drive_photos_link", url: property.drive_photos_link }] : []),
          ...(property.drive_brochure_link ? [{ media_type: "brochure", source: "drive_brochure_link", url: property.drive_brochure_link }] : []),
        ].filter((asset) => requestedType === "any" || asset.media_type === requestedType || (requestedType === "image" && asset.media_type === "image_or_gallery"));

        return {
          found: true,
          property: {
            id: property.id,
            title: property.title,
            type: property.type,
            location_city: property.location_city,
            location_area: property.location_area,
            status: property.status,
          },
          assets,
          catalog_links: catalogLinks,
          has_registered_media: assets.length > 0,
          warning: assets.length === 0 && catalogLinks.length === 0 ? "No approved media is registered for this property." : null,
        };
      },
    },
    {
      name: "send_property_media",
      description: "Send one registered, approved property image, video or document to the verified customer in the current WhatsApp conversation. Use only an asset ID returned by get_property_media. The recipient, property ownership, asset URL and 24-hour service window are verified server-side and cannot be supplied by the model.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          assetId: { type: "string" },
        },
        required: ["assetId"],
      },
      execute: async (input, ctx) => {
        const assetId = text(input.assetId);
        if (!assetId) throw new Error("assetId is required.");
        const admin = createAdminClient();
        const { data: asset, error: assetError } = await admin
          .from("media_assets")
          .select("id,organization_id,property_id,storage_bucket,storage_path,mime_type,file_name,caption,send_status,metadata")
          .eq("id", assetId)
          .eq("organization_id", ctx.organizationId)
          .maybeSingle();
        if (assetError) throw assetError;
        if (!asset || !asset.property_id) throw new Error("The requested media asset is not registered to a property in this tenant.");
        if (!approvedMedia(asset.metadata)) throw new Error("The requested media asset is not approved for customer delivery.");

        const kind = mediaKind(asset.mime_type, asset.metadata);
        if (!["image", "video", "document"].includes(kind)) throw new Error(`Unsupported WhatsApp property media type: ${kind}.`);

        const { data: property, error: propertyError } = await admin
          .from("properties")
          .select("id,title,location_city,location_area,status")
          .eq("id", asset.property_id)
          .eq("organization_id", ctx.organizationId)
          .maybeSingle();
        if (propertyError) throw propertyError;
        if (!property) throw new Error("The media asset does not belong to a property in this tenant.");

        const metadata = object(asset.metadata);
        let publicUrl = text(metadata.public_url);
        if (!publicUrl && asset.storage_bucket && asset.storage_path) {
          const resolved = admin.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path);
          publicUrl = text(resolved.data?.publicUrl);
        }
        if (!publicUrl) throw new Error("The approved property media asset has no deliverable URL.");

        const recipient = await resolveTrustedWhatsAppRecipient(ctx);
        const commandId = `maia-property-media:${ctx.sessionId}:${asset.id}:${crypto.randomUUID()}`;
        const result = await dispatchMaiaPropertyMedia({
          commandId,
          recipient: recipient.phone,
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
          conversation_id: recipient.conversationId,
          customer_id: recipient.customerId,
          property_title: property.title,
          last_customer_message_at: recipient.lastInboundAt,
          recipient_verified: true,
        };
      },
    },
  ];
}
