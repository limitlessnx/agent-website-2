import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLeadPhone, type ProgressiveLead } from "@/lib/lead-profile-service";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export type MaiaCampaignAction = {
  commandId: string;
  campaignType?: string;
  templateName?: string;
  topic: string;
  message: string;
  recipients: ProgressiveLead[];
  propertyTitle?: string;
  mediaUrl?: string;
  createdBy?: string;
};

export type MaiaWhatsAppFollowUpAction = {
  commandId: string;
  recipient: string;
  recipientName?: string;
  message: string;
  deliveryMode: "direct" | "template";
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: string[];
  templateVariableKeys?: string[];
  topic?: string;
  propertyTitle?: string;
  createdBy?: string;
};

async function resolveOrganizationId() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("id").eq("slug", "limitless-realty").maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Limitless Realty organization is not configured.");
  return String(data.id);
}

async function lastInboundAt(organizationId: string, phone: string) {
  const admin = createAdminClient();
  const normalized = normalizeLeadPhone(phone);
  const { data: conversation, error: conversationError } = await admin
    .from("agent_conversations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("external_thread_key", normalized)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation?.id) return null;
  const { data: message, error: messageError } = await admin
    .from("conversation_messages")
    .select("created_at")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversation.id)
    .eq("sender_type", "customer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (messageError) throw messageError;
  return message?.created_at ? String(message.created_at) : null;
}

function mediaUrlForType(url: string, type: "image" | "video" | "document") {
  if (type === "document") return undefined;
  if (type === "video") return { propertyVideoUrls: [url] };
  return { propertyImageUrls: [url] };
}

function inferMediaType(url: string) {
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm)$/.test(clean)) return "video" as const;
  if (/\.(jpe?g|png|webp|gif)$/.test(clean)) return "image" as const;
  return null;
}

async function sendCampaignRecipient(
  organizationId: string,
  command: MaiaCampaignAction,
  lead: ProgressiveLead,
) {
  const phone = normalizeLeadPhone(String(lead.phone || ""));
  if (!phone) return { accepted: false, failed: true, reason: "invalid_phone" };

  const inbound = await lastInboundAt(organizationId, phone);
  const isDirect = command.campaignType === "direct_message";
  if (isDirect) {
    if (!inbound || Date.now() - new Date(inbound).getTime() >= 24 * 60 * 60 * 1000) {
      return { accepted: false, failed: false, skipped: true, reason: "outside_24h_window" };
    }
  }

  const mediaType = command.mediaUrl ? inferMediaType(command.mediaUrl) : null;
  const variables = {
    customer_name: String(lead.name || "there").trim() || "there",
    lead_name: String(lead.name || "there").trim() || "there",
    message: command.message,
    custom_message: command.message,
    last_customer_message: command.message,
    conversation_summary: command.message,
    customer_goal: String(lead.purpose || "").trim(),
    property_interest: String(lead.property_interest || command.propertyTitle || "").trim(),
    property_name: String(command.propertyTitle || lead.property_interest || "").trim(),
    property_location: String(lead.location_preference || "").trim(),
    response_prompt: "Reply CHANNEL if you want to join our Limitless Realty WhatsApp Channel.",
    topic: command.topic,
  };

  const delivery = await sendWhatsAppMessage({
    organizationId,
    to: phone,
    text: command.message,
    lastCustomerMessageAt: inbound,
    deliveryMode: isDirect ? "direct" : "auto",
    templatePurpose: command.campaignType === "limitless_realty_reminder" ? "follow_up_outside_24h" : "campaign",
    templateName: isDirect ? undefined : command.templateName,
    variables,
    ...(mediaType ? mediaUrlForType(command.mediaUrl || "", mediaType) : {}),
  });

  return {
    accepted: true,
    failed: false,
    skipped: false,
    phone,
    name: lead.name,
    providerMessageId: delivery.providerMessageId,
    messageType: delivery.messageType,
    templateName: delivery.templateName,
    provider: delivery.provider,
  };
}

export async function dispatchMaiaCampaignAction(command: MaiaCampaignAction) {
  if (!command.message.trim()) throw new Error("A campaign message is required.");
  if (!command.recipients.length) throw new Error("The campaign has no recipients.");

  const organizationId = await resolveOrganizationId();
  const results: Array<Record<string, unknown>> = [];
  for (const lead of command.recipients) {
    try {
      results.push(await sendCampaignRecipient(organizationId, command, lead));
    } catch (error) {
      results.push({
        accepted: false,
        failed: true,
        phone: normalizeLeadPhone(String(lead.phone || "")),
        name: lead.name,
        reason: error instanceof Error ? error.message : "WhatsApp delivery failed",
      });
    }
  }

  const acceptedRecipients = results.filter((item) => item.accepted);
  const failedRecipients = results.filter((item) => item.failed);
  const skippedRecipients = results.filter((item) => item.skipped);
  const firstError = failedRecipients[0]?.reason;
  return {
    route: "trigger-dev-meta-cloud-api",
    executionId: command.commandId,
    path: ["trigger-dev", "canonical-whatsapp-delivery"],
    summary: {
      status: failedRecipients.length && acceptedRecipients.length ? "partially_sent" : failedRecipients.length ? "failed" : "submitted",
      attempted: command.recipients.length,
      submitted: acceptedRecipients.length,
      accepted_by_whatsapp_api: acceptedRecipients.length,
      immediate_failed: failedRecipients.length,
      skipped: skippedRecipients.length,
      pending_delivery_confirmation: acceptedRecipients.length,
      free_form_sent: acceptedRecipients.filter((item) => item.messageType === "text").length,
      template_sent: acceptedRecipients.filter((item) => item.messageType === "template").length,
      template_name: acceptedRecipients.find((item) => item.templateName)?.templateName || null,
      failed_recipients: failedRecipients,
      accepted_recipients: acceptedRecipients,
      message: firstError || "Campaign submitted through the canonical WhatsApp delivery gateway.",
    },
    attempted: command.recipients.length,
    accepted: acceptedRecipients.length,
    failed: failedRecipients.length,
    skipped: skippedRecipients.length,
    pendingDelivery: acceptedRecipients.length,
    freeFormSent: acceptedRecipients.filter((item) => item.messageType === "text").length,
    templateSent: acceptedRecipients.filter((item) => item.messageType === "template").length,
    acceptedRecipients,
    failedRecipients,
    status: failedRecipients.length && acceptedRecipients.length ? "partially_sent" : failedRecipients.length ? "failed" : "submitted",
    message: firstError || "Campaign submitted through the canonical WhatsApp delivery gateway.",
  };
}

export async function dispatchMaiaWhatsAppFollowUp(command: MaiaWhatsAppFollowUpAction) {
  const organizationId = await resolveOrganizationId();
  const phone = normalizeLeadPhone(command.recipient);
  if (!phone) throw new Error("A valid WhatsApp recipient is required.");
  if (!command.message.trim()) throw new Error("A follow-up message is required.");

  const inbound = await lastInboundAt(organizationId, phone);
  const delivery = await sendWhatsAppMessage({
    organizationId,
    to: phone,
    text: command.message,
    lastCustomerMessageAt: inbound,
    deliveryMode: command.deliveryMode,
    templatePurpose: "follow_up_outside_24h",
    templateName: command.templateName,
    templateLanguageCode: command.templateLanguage,
    variables: Object.fromEntries((command.templateVariableKeys || []).map((key, index) => [key, command.templateParameters?.[index] || "Not specified"])),
  });

  return {
    route: "trigger-dev-meta-cloud-api",
    executionId: command.commandId,
    path: ["trigger-dev", "canonical-whatsapp-delivery"],
    summary: { accepted_by_whatsapp_api: delivery.ok ? 1 : 0, submitted: delivery.ok ? 1 : 0, immediate_failed: 0, status: "submitted" },
    accepted: delivery.ok ? 1 : 0,
    failed: 0,
    pendingDelivery: delivery.ok ? 1 : 0,
    freeFormSent: delivery.messageType === "text" ? 1 : 0,
    templateSent: delivery.messageType === "template" ? 1 : 0,
    templateName: delivery.templateName,
    status: "submitted",
    message: "Maia follow-up submitted through the canonical WhatsApp delivery gateway.",
  };
}
