import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export type MaiaPropertyMediaDispatch = {
  commandId: string;
  organizationId: string;
  recipient: string;
  propertyId: string;
  propertyTitle: string;
  assetId: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "document";
  mimeType?: string;
  fileName?: string;
  caption?: string;
  lastCustomerMessageAt: string;
};

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export async function dispatchMaiaPropertyMedia(command: MaiaPropertyMediaDispatch) {
  const phone = normalizePhone(command.recipient);
  if (!phone) throw new Error("A verified WhatsApp recipient is required.");
  if (!command.mediaUrl.trim()) throw new Error("The approved media asset has no usable URL.");
  if (!command.assetId.trim() || !command.propertyId.trim()) {
    throw new Error("A registered property media asset is required.");
  }
  if (command.mediaType === "document") {
    throw new Error("Direct document delivery is not yet supported by the canonical Maia WhatsApp media gateway.");
  }

  // Claim before calling Meta. A unique database key protects concurrent workers and retries.
  // On an ambiguous provider failure, retain the claim rather than risk a second image.
  const commandKey = createHash("sha256").update(command.commandId).digest("hex");
  const admin = createAdminClient();
  const { error: claimError } = await admin.from("maia_media_send_claims").insert({
    organization_id: command.organizationId,
    command_key: commandKey,
    asset_id: command.assetId,
    recipient: phone,
    status: "claimed",
  });
  if (claimError) {
    if (claimError.code === "23505") {
      return { accepted: false, status: "duplicate_suppressed", asset_id: command.assetId, property_id: command.propertyId, media_type: command.mediaType, provider_message_id: null, provider: "meta", message: "This media asset was already claimed for this customer request." };
    }
    throw claimError; // Fail closed if the claim table is missing or inaccessible.
  }

  const caption = String(command.caption || command.propertyTitle || "Property media").trim().slice(0, 900);
  const delivery = await sendWhatsAppMessage({
    organizationId: command.organizationId,
    to: phone,
    text: caption,
    lastCustomerMessageAt: command.lastCustomerMessageAt,
    deliveryMode: "direct",
    ...(command.mediaType === "image"
      ? { propertyImageUrls: [command.mediaUrl] }
      : { propertyVideoUrls: [command.mediaUrl] }),
  });

  await admin.from("maia_media_send_claims").update({ status: delivery.ok ? "accepted" : "failed", provider_message_id: delivery.providerMessageId || null }).eq("organization_id", command.organizationId).eq("command_key", commandKey);

  return {
    accepted: Boolean(delivery.ok),
    status: delivery.ok ? "accepted_by_api" : "failed",
    provider_message_id: delivery.providerMessageId || null,
    provider: delivery.provider,
    asset_id: command.assetId,
    property_id: command.propertyId,
    media_type: command.mediaType,
    message: "Approved property media and its caption were submitted through the tenant WhatsApp delivery gateway.",
  };
}
