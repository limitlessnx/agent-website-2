import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getProperties } from "@/lib/limitless-data";
import {
  getCampaignAudienceLeads,
  type ProgressiveLead,
} from "@/lib/lead-profile-service";
import { dispatchMaiaCampaignAction } from "@/lib/maia-action-gateway";
import { repairMaiaActionWorkflowInput } from "@/lib/maia-action-workflow-repair";
import { repairMaiaCampaignFormatting } from "@/lib/maia-campaign-format-repair";
import { saveCampaignDeliveryReport } from "@/lib/campaign-report-store";
import { splitWhatsAppMessage } from "@/lib/whatsapp-message-splitter";
import {
  buildPropertyCampaignContent,
  PropertyCampaignMessageError,
} from "@/lib/property-campaign-message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  requestId?: string;
  topic?: string;
  message?: string;
  mediaUrl?: string;
  audienceMode?: "all" | "manual" | "filters";
  selectedLeadIds?: string[];
  state?: string;
  interest?: string;
  propertyId?: string;
  budgetMin?: number | string;
  budgetMax?: number | string;
};

type CachedResponse = { expiresAt: number; payload: Record<string, unknown> };
const globalCache = globalThis as typeof globalThis & { __maiaCampaignRequests?: Map<string, CachedResponse> };
const requestCache = globalCache.__maiaCampaignRequests || new Map<string, CachedResponse>();
globalCache.__maiaCampaignRequests = requestCache;

function text(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function money(value: unknown) {
  const digits = String(value || "").replace(/[^\d.]/g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isContactable(lead: ProgressiveLead) {
  const status = text(lead.status);
  return Boolean(
    lead.phone &&
      lead.campaign_eligible !== false &&
      !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status),
  );
}

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (value.expiresAt <= now) requestCache.delete(key);
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    cleanCache();
    const body = (await request.json()) as RequestBody;
    const requestId = String(body.requestId || "").trim();
    if (!requestId) return NextResponse.json({ error: "Campaign request ID is required." }, { status: 400 });

    const cached = requestCache.get(requestId);
    if (cached) return NextResponse.json({ ...cached.payload, duplicatePrevented: true });

    const originalMessage = String(body.message || "").trim();
    const [allLeads, properties] = await Promise.all([
      getCampaignAudienceLeads(10000),
      getProperties(500),
    ]);

    const selectedIds = new Set((body.selectedLeadIds || []).map(String));
    const selectedProperty = properties.find((property) => property.id === body.propertyId);
    const propertyCampaign = selectedProperty
      ? buildPropertyCampaignContent(selectedProperty, originalMessage, String(body.mediaUrl || ""))
      : null;
    const message = propertyCampaign?.message || originalMessage;
    const topic = String(
      body.topic || (propertyCampaign ? `${propertyCampaign.propertyName} property update` : "WhatsApp campaign"),
    ).trim();

    if (!message) return NextResponse.json({ error: "Campaign message is required." }, { status: 400 });

    const messageParts = splitWhatsAppMessage(message);
    if (!messageParts.length) {
      return NextResponse.json({ error: "Campaign message is required." }, { status: 400 });
    }

    const state = text(body.state);
    const interest = text(body.interest);
    const propertyNeedle = text(selectedProperty?.title || body.propertyId);
    const budgetMin = money(body.budgetMin);
    const budgetMax = money(body.budgetMax);
    const mode = body.audienceMode || "all";

    const recipients = allLeads.filter((lead) => {
      if (!isContactable(lead)) return false;
      if (mode === "manual") return selectedIds.has(String(lead.id));
      if (mode === "all") return true;
      if (state && !text(lead.location_preference).includes(state)) return false;
      if (interest) {
        const searchable = [lead.purpose, lead.property_type, lead.property_interest].map(text).join(" ");
        if (!searchable.includes(interest)) return false;
      }
      if (propertyNeedle) {
        const searchable = [lead.property_interest, lead.property_type, lead.purpose].map(text).join(" ");
        if (!searchable.includes(propertyNeedle)) return false;
      }
      const budget = money(lead.budget);
      if (budgetMin && (!budget || budget < budgetMin)) return false;
      if (budgetMax && (!budget || budget > budgetMax)) return false;
      return true;
    });

    if (!recipients.length) {
      return NextResponse.json({ error: "No campaign-eligible leads matched this audience." }, { status: 400 });
    }

    await repairMaiaActionWorkflowInput();
    await repairMaiaCampaignFormatting();

    const campaignId = requestId;
    const createdBy = String(
      (session as { email?: string; id?: string }).email ||
        (session as { id?: string }).id ||
        "admin_dashboard",
    );

    const dispatches = [];
    for (let index = 0; index < messageParts.length; index += 1) {
      dispatches.push(await dispatchMaiaCampaignAction({
        commandId: messageParts.length === 1 ? campaignId : `${campaignId}-part-${index + 1}`,
        topic,
        message: messageParts[index],
        recipients,
        propertyTitle: propertyCampaign?.propertyName || selectedProperty?.title,
        createdBy,
      }));
    }

    const firstDispatch = dispatches[0];
    const accepted = Math.min(...dispatches.map((item) => Number(item.accepted || 0)));
    const failed = Math.max(...dispatches.map((item) => Number(item.failed || 0)));
    const skipped = Math.max(...dispatches.map((item) => Number(item.skipped || 0)));
    const pendingDelivery = dispatches.reduce((total, item) => total + Number(item.pendingDelivery || 0), 0);
    const delivered = dispatches.reduce(
      (total, item) => total + Number((item.summary as Record<string, unknown>).delivered || 0),
      0,
    );
    const read = dispatches.reduce(
      (total, item) => total + Number((item.summary as Record<string, unknown>).read || 0),
      0,
    );
    const freeFormSent = dispatches.reduce((total, item) => total + Number(item.freeFormSent || 0), 0);
    const templateSent = dispatches.reduce((total, item) => total + Number(item.templateSent || 0), 0);
    const failedRecipients = dispatches.flatMap((item) => item.failedRecipients || []);
    const status = delivered > 0
      ? pendingDelivery > 0 ? "partially_delivered" : "delivered"
      : failed > 0 && accepted > 0
        ? "partially_sent"
        : accepted > 0
          ? "sent"
          : "failed";

    const payload = {
      ok: accepted > 0,
      campaignId,
      requestId,
      attempted: recipients.length,
      sent: accepted,
      accepted,
      delivered,
      read,
      failed,
      skipped,
      pendingDelivery,
      freeFormSent,
      templateSent,
      messageParts: messageParts.length,
      originalCharacterCount: message.length,
      status,
      providerStatus: dispatches.map((item) => item.status),
      message: messageParts.length > 1
        ? `Campaign submitted in ${messageParts.length} WhatsApp message parts.`
        : firstDispatch.message,
      acceptedRecipients: firstDispatch.acceptedRecipients,
      failedRecipients,
      executionId: dispatches.map((item) => item.executionId).join(","),
      workflowPath: [...new Set(dispatches.flatMap((item) => item.path || []))],
      maiaCommandPath: firstDispatch.route,
      duplicatePrevented: false,
      propertyContext: propertyCampaign?.memory || null,
      exactPropertyReply: propertyCampaign?.replyInstruction || null,
    };

    requestCache.set(requestId, { expiresAt: Date.now() + 10 * 60 * 1000, payload });

    await saveCampaignDeliveryReport({
      id: campaignId,
      campaign_topic: topic,
      command_id: campaignId,
      execution_id: payload.executionId,
      status,
      attempted: recipients.length,
      accepted,
      delivered,
      read,
      failed,
      skipped,
      pending_delivery: pendingDelivery,
      accepted_recipients: firstDispatch.acceptedRecipients,
      failed_recipients: failedRecipients,
      workflow_path: payload.workflowPath,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    }).catch((error) => console.error("Campaign audit save failed.", error));

    return NextResponse.json(payload);
  } catch (error) {
    console.error("WhatsApp campaign dispatch failed.", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign dispatch failed." },
      { status: error instanceof PropertyCampaignMessageError ? 400 : 500 },
    );
  }
}
