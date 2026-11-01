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

  const caption = String(command.caption || command.propertyTitle || "Property media").trim().slice(0, 900);
  const delivery = await sendWhatsAppMessage({
    organizationId: "b15f21b4-5697-4d21-9421-8a34eae3476d",
    to: phone,
    text: caption,
    lastCustomerMessageAt: command.lastCustomerMessageAt,
    deliveryMode: "direct",
    ...(command.mediaType === "image"
      ? { propertyImageUrls: [command.mediaUrl] }
      : { propertyVideoUrls: [command.mediaUrl] }),
  });

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
