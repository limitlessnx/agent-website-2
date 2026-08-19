import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCampaignGroup, matchesCampaignGroupRules } from "@/lib/campaign-groups";
import { getCampaignAudienceLeads, normalizeLeadPhone, type ProgressiveLead } from "@/lib/lead-profile-service";
import { dispatchMaiaCampaignAction } from "@/lib/maia-action-gateway";
import { splitWhatsAppMessage } from "@/lib/whatsapp-message-splitter";
import { getMetaCooldownPhones } from "@/lib/whatsapp-status-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { requestId?: string; topic?: string; message?: string; mediaUrl?: string; audienceMode?: "all" | "manual" | "group" | "filters"; selectedLeadIds?: string[]; campaignGroupId?: string; state?: string; interest?: string; propertyId?: string; budgetMin?: string | number; budgetMax?: string | number };
function text(value: unknown) { return String(value || "").trim().toLowerCase(); }
function money(value: unknown) { const parsed = Number(String(value || "").replace(/[^\d.]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function contactable(lead: ProgressiveLead) { const status = text(lead.status); return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status)); }

export async function POST(request: Request) {
  const session = await getAdminSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as Body; const requestId = String(body.requestId || "").trim(); const message = String(body.message || "").trim();
    if (!requestId) return NextResponse.json({ error: "Direct message request ID is required." }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Direct message is required." }, { status: 400 });
    const [leads] = await Promise.all([getCampaignAudienceLeads(10000)]);
    const selected = new Set((body.selectedLeadIds || []).map(String)); const group = body.campaignGroupId ? await getCampaignGroup(String(body.campaignGroupId)) : null; const groupIds = new Set(group?.leadIds || []); const groupPhones = new Set((group?.phones || []).map(normalizeLeadPhone).filter(Boolean));
    const mode = body.audienceMode || "all"; const state = text(body.state); const interest = text(body.interest); const min = money(body.budgetMin); const max = money(body.budgetMax);
    const recipients = leads.filter((lead) => {
      if (!contactable(lead)) return false;
      if (mode === "manual") return selected.has(String(lead.id));
      if (mode === "group") return group ? group.groupType === "smart" ? matchesCampaignGroupRules(lead, group.rules) : groupIds.has(String(lead.id)) || groupPhones.has(normalizeLeadPhone(lead.phone)) : false;
      if (mode === "filters") {
        if (state && !text(lead.location_preference).includes(state)) return false;
        if (interest && ![lead.purpose, lead.property_type, lead.property_interest].map(text).join(" ").includes(interest)) return false;
        const budget = money(lead.budget); if (min && (!budget || budget < min)) return false; if (max && (!budget || budget > max)) return false;
      }
      return true;
    });
    const cooldowns = await getMetaCooldownPhones(recipients.map((lead) => lead.phone), 24); const eligibleRecipients = recipients.filter((lead) => !cooldowns.has(normalizeLeadPhone(lead.phone)));
    if (!eligibleRecipients.length) return NextResponse.json({ error: "No eligible recipients remain after WhatsApp cooldown checks." }, { status: 400 });
    const parts = splitWhatsAppMessage(message); const createdBy = String((session as { email?: string; id?: string }).email || (session as { id?: string }).id || "admin_dashboard"); const dispatches = [];
    for (let i = 0; i < parts.length; i += 1) dispatches.push(await dispatchMaiaCampaignAction({ commandId: parts.length === 1 ? requestId : `${requestId}-part-${i + 1}`, campaignType: "direct_message", topic: String(body.topic || "Direct WhatsApp Message"), message: parts[i], recipients: eligibleRecipients, mediaUrl: String(body.mediaUrl || "").trim() || undefined, createdBy }));
    const accepted = Math.min(...dispatches.map((item) => Number(item.accepted || 0))); const failed = Math.max(...dispatches.map((item) => Number(item.failed || 0))); const pending = dispatches.reduce((sum, item) => sum + Number(item.pendingDelivery || 0), 0); const delivered = dispatches.reduce((sum, item) => sum + Number((item.summary as Record<string, unknown>).delivered || 0), 0);
    return NextResponse.json({ ok: accepted > 0, campaignType: "direct_message", attempted: eligibleRecipients.length, sent: accepted, delivered, pendingDelivery: pending, failed, skipped: recipients.length - eligibleRecipients.length, messageParts: parts.length, status: delivered ? pending ? "partially_delivered" : "delivered" : accepted ? "sent" : "failed", templateName: null, executionId: dispatches.map((item) => item.executionId).join(","), workflowPath: [...new Set(dispatches.flatMap((item) => item.path || []))] });
  } catch (error) {
    console.error("Direct WhatsApp campaign failed.", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Direct campaign failed." }, { status: 500 });
  }
}
