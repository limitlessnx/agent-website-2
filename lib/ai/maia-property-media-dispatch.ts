import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLeadPhone } from "@/lib/lead-profile-service";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export type MaiaPropertyMediaDispatch = {
  commandId: string;
  recipient: string;
  propertyId: string;
  propertyTitle: string;
  assetId: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "document";
  mimeType?: string;
  fileName?: string;
  caption?: string;
};

export async function dispatchMaiaPropertyMedia(command: MaiaPropertyMediaDispatch) {
  const phone = normalizeLeadPhone(command.recipient);
  if (!phone) throw new Error("A valid verified WhatsApp recipient is required.");
  if (!command.mediaUrl.trim()) throw new Error("The approved media asset has no usable URL.");
  if (!command.assetId.trim() || !command.propertyId.trim()) throw new Error("A registered property media asset is required.");
  if (command.mediaType === "document") throw new Error("Document delivery is not enabled on the canonical property-media route yet.");

  const admin = createAdminClient();
  const { data: organization, error } = await admin.from("organizations").select("id").eq("slug", "limitless-realty").maybeSingle();
  if (error) throw error;
  if (!organization?.id) throw new Error("Limitless Realty organization is not configured.");

  const result = await sendWhatsAppMessage({
    organizationId: String(organization.id),
    to: phone,
    text: command.caption || command.propertyTitle || "Property media",
    deliveryMode: "direct",
    propertyImageUrls: command.mediaType === "image" ? [command.mediaUrl] : [],
    propertyVideoUrls: command.mediaType === "video" ? [command.mediaUrl] : [],
  });

  return {
    accepted: result.ok,
    status: result.ok ? "accepted_by_api" : "failed",
    execution_id: command.commandId,
    provider: result.provider,
    provider_message_id: result.providerMessageId,
    asset_id: command.assetId,
    property_id: command.propertyId,
    media_type: command.mediaType,
    pending_delivery_confirmation: result.ok ? 1 : 0,
    free_form_sent: result.messageType === "text" ? 1 : 0,
    accepted_recipients: result.ok ? [{ phone, name: command.propertyTitle }] : [],
    failed_recipients: [],
    message: "Property media submitted through the canonical WhatsApp delivery gateway.",
  };
}
