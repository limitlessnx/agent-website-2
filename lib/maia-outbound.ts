import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export async function dispatchMaiaOutboundMessage(input: {
  organizationId: string;
  to: string;
  text: string;
  deliveryMode: "direct" | "template";
  lastCustomerMessageAt?: string;
}) {
  // Limitless property media is sent explicitly by Maia property tools.
  // Never infer a second attachment from the final conversational reply.
  return sendWhatsAppMessage({ ...input, textOnly: input.organizationId === "b15f21b4-5697-4d21-9421-8a34eae3476d" });
}
