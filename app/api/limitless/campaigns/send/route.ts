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

    const topic = String(body.topic || "WhatsApp campaign").trim();
    const message = String(body.message || "").trim();
    if (!message) return NextResponse.json({ error: "Campaign message is required." }, { status: 400 });

    const [allLeads, properties] = await Promise.all([
      getCampaignAudienceLeads(10000),
      getProperties(500),
    ]);

    const selectedIds = new Set((body.selectedLeadIds || []).map(String));
    const selectedProperty = properties.find((property) => property.id === body.propertyId);
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

    const dispatch = await dispatchMaiaCampaignAction({
      commandId: campaignId,
      topic,
      message,
      recipients,
      propertyTitle: selectedProperty?.title,
      createdBy,
    });

    const delivered = Number((dispatch.summary as Record<string, unknown>).delivered || 0);
    const read = Number((dispatch.summary as Record<string, unknown>).read || 0);
    const pendingDelivery = Math.max(0, Number(dispatch.pendingDelivery || 0));
    const status = delivered > 0
      ? pendingDelivery > 0 ? "partially_delivered" : "delivered"
      : dispatch.failed > 0 && dispatch.accepted > 0
        ? "partially_sent"
        : dispatch.accepted > 0
          ? "sent"
          : "failed";

    const payload = {
      ok: dispatch.accepted > 0,
      campaignId,
      requestId,
      attempted: dispatch.attempted,
      sent: dispatch.accepted,
      accepted: dispatch.accepted,
      delivered,
      read,
      failed: dispatch.failed,
      skipped: dispatch.skipped,
      pendingDelivery,
      freeFormSent: dispatch.freeFormSent,
      templateSent: dispatch.templateSent,
      status,
      providerStatus: dispatch.status,
      message: dispatch.message,
      acceptedRecipients: dispatch.acceptedRecipients,
      failedRecipients: dispatch.failedRecipients,
      executionId: dispatch.executionId,
      workflowPath: dispatch.path,
      maiaCommandPath: dispatch.route,
      duplicatePrevented: false,
    };

    requestCache.set(requestId, { expiresAt: Date.now() + 10 * 60 * 1000, payload });

    await saveCampaignDeliveryReport({
      id: campaignId,
      campaign_topic: topic,
      command_id: campaignId,
      execution_id: dispatch.executionId,
      status,
      attempted: dispatch.attempted,
      accepted: dispatch.accepted,
      delivered,
      read,
      failed: dispatch.failed,
      skipped: dispatch.skipped,
      pending_delivery: pendingDelivery,
      accepted_recipients: dispatch.acceptedRecipients,
      failed_recipients: dispatch.failedRecipients,
      workflow_path: dispatch.path,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    }).catch((error) => console.error("Campaign audit save failed.", error));

    return NextResponse.json(payload);
  } catch (error) {
    console.error("WhatsApp campaign dispatch failed.", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign dispatch failed." },
      { status: 500 },
    );
  }
}
