import { createAdminClient } from "@/lib/supabase/admin";

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

function mediaKind(mimeType: unknown, metadata: unknown) {
  const mime = text(mimeType).toLowerCase();
  const meta = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  const explicit = text(meta.media_type || meta.asset_type).toLowerCase();
  if (explicit) return explicit;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "document";
  return "file";
}

function approvedMedia(metadata: unknown) {
  const meta = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  if (meta.approved === false || meta.status === "rejected" || meta.disabled === true) return false;
  return true;
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
  ];
}
