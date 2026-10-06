import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export async function dispatchMaiaOutboundMessage(input: {
  organizationId: string;
  to: string;
  text: string;
  deliveryMode: "direct" | "template";
  lastCustomerMessageAt?: string;
}) {
  return sendWhatsAppMessage(input);
}
