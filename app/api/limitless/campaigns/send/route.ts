import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getProperties } from "@/lib/limitless-data";
import {
  getCampaignAudienceLeads,
  type ProgressiveLead,
} from "@/lib/lead-profile-service";
import { dispatchMaiaCampaignAction } from "@/lib/maia-action-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
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

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as RequestBody;
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
        const searchable = [lead.purpose, lead.property_type, lead.property_interest]
          .map(text)
          .join(" ");
        if (!searchable.includes(interest)) return false;
      }

      if (propertyNeedle) {
        const searchable = [lead.property_interest, lead.property_type, lead.purpose]
          .map(text)
          .join(" ");
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

    const campaignId = crypto.randomUUID();
    const dispatch = await dispatchMaiaCampaignAction({
      commandId: campaignId,
      topic,
      message,
      recipients,
      propertyTitle: selectedProperty?.title,
      createdBy: String((session as { email?: string; id?: string }).email || (session as { id?: string }).id || "admin_dashboard"),
    });

    return NextResponse.json({
      ok: true,
      campaignId,
      attempted: dispatch.attempted,
      completed: dispatch.accepted,
      accepted: dispatch.accepted,
      acceptedByWhatsAppApi: dispatch.accepted,
      failed: dispatch.failed,
      immediateFailed: dispatch.failed,
      skipped: dispatch.skipped,
      pendingDeliveryConfirmation: dispatch.pendingDelivery,
      freeFormSent: dispatch.freeFormSent,
      templateSent: dispatch.templateSent,
      status: dispatch.status,
      message: dispatch.message,
      acceptedRecipients: dispatch.acceptedRecipients,
      failedRecipients: dispatch.failedRecipients,
      executionId: dispatch.executionId,
      workflowPath: dispatch.path,
      maiaCommandPath: dispatch.route,
    });
  } catch (error) {
    console.error("WhatsApp campaign dispatch failed.", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign dispatch failed." },
      { status: 500 },
    );
  }
}
