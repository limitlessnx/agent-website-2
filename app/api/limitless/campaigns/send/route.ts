import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCampaignGroup, matchesCampaignGroupRules } from "@/lib/campaign-groups";
import { getProperties } from "@/lib/limitless-data";
import { getCampaignAudienceLeads, normalizeLeadPhone, type ProgressiveLead } from "@/lib/lead-profile-service";
import { dispatchMaiaCampaignAction } from "@/lib/maia-action-gateway";
import { repairMaiaActionWorkflowInput } from "@/lib/maia-action-workflow-repair";
import { repairMaiaCampaignFormatting } from "@/lib/maia-campaign-format-repair";
import { saveCampaignDeliveryReport } from "@/lib/campaign-report-store";
import { splitWhatsAppMessage } from "@/lib/whatsapp-message-splitter";
import { buildPropertyCampaignContent, PropertyCampaignMessageError } from "@/lib/property-campaign-message";
import { getMetaCooldownPhones } from "@/lib/whatsapp-status-log";

export const runtime = "nodejs";

type RequestBody = {
  requestId?: string;
  campaignType?: string;
  topic?: string;
  message?: string;
  mediaUrl?: string;
  audienceMode?: string;
  selectedLeadIds?: string[];
  campaignGroupId?: string;
  state?: string;
  interest?: string;
  propertyId?: string;
  budgetMin?: string;
  budgetMax?: string;
};

type CachedResponse = { expiresAt: number; payload: Record<string, unknown> };

const campaignTemplates: Record<string, string> = {
  new_estate_update: "estate_brief_update",
  limitless_realty_update: "limitless_realty_update_v2",
  limitless_realty_reminder: "limitless_realty_reminder",
};

const globalCache = globalThis as typeof globalThis & { __maiaCampaignRequests?: Map<string, CachedResponse> };
const requestCache = globalCache.__maiaCampaignRequests || new Map<string, CachedResponse>();
globalCache.__maiaCampaignRequests = requestCache;

function text(value: unknown) { return String(value || "").trim().toLowerCase(); }
function money(value: unknown) { const digits = String(value || "").replace(/[^\d.]/g, ""); const parsed = Number(digits); return Number.isFinite(parsed) ? parsed : 0; }
function isContactable(lead: ProgressiveLead) { const status = text(lead.status); return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status)); }
function cleanCache() { const now = Date.now(); for (const [key, value] of requestCache.entries()) if (value.expiresAt <= now) requestCache.delete(key); }

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  cleanCache();

  try {
    const body = (await request.json()) as RequestBody;
    const requestId = String(body.requestId || "").trim();
    if (!requestId) return NextResponse.json({ error: "Campaign request ID is required." }, { status: 400 });
    const cached = requestCache.get(requestId);
    if (cached) return NextResponse.json({ ...cached.payload, duplicatePrevented: true });

    const originalMessage = String(body.message || "").trim();
    const [allLeads, properties] = await Promise.all([getCampaignAudienceLeads(10000), getProperties(500)]);
    const selectedIds = new Set((body.selectedLeadIds || []).map(String));
    const campaignGroup = body.campaignGroupId ? await getCampaignGroup(String(body.campaignGroupId)) : null;
    const groupLeadIds = new Set(campaignGroup?.leadIds || []);
    const groupPhones = new Set((campaignGroup?.phones || []).map(normalizeLeadPhone).filter(Boolean));
    const campaignType = body.campaignType && body.campaignType in campaignTemplates ? body.campaignType : "limitless_realty_update";
    const templateName = campaignTemplates[campaignType];
    const selectedProperty = properties.find((property) => property.id === body.propertyId);
    const propertyCampaign = selectedProperty ? buildPropertyCampaignContent(selectedProperty, originalMessage, String(body.mediaUrl || "")) : null;
    const message = propertyCampaign?.message || originalMessage;
    const topic = String(body.topic || (propertyCampaign ? `${propertyCampaign.propertyName} property update` : "WhatsApp campaign")).trim();
    if (!message) return NextResponse.json({ error: "Campaign message is required." }, { status: 400 });

    // v2 is a single approved Meta template. mediaUrl is metadata/link input only;
    // it must never be sent as a WhatsApp media attachment.
    const messageParts = campaignType === "limitless_realty_update" ? [message] : splitWhatsAppMessage(message);
    if (!messageParts.length) return NextResponse.json({ error: "Campaign message is required." }, { status: 400 });

    const state = text(body.state);
    const interest = text(body.interest);
    const budgetMin = money(body.budgetMin);
    const budgetMax = money(body.budgetMax);
    const mode = text(body.audienceMode);
    const matchedRecipients = allLeads.filter((lead) => {
      if (!isContactable(lead)) return false;
      if (mode === "manual") return selectedIds.has(String(lead.id));
      if (mode === "group") {
        if (!campaignGroup) return false;
        return campaignGroup.groupType === "smart" ? matchesCampaignGroupRules(lead, campaignGroup.rules) : groupLeadIds.has(String(lead.id)) || groupPhones.has(normalizeLeadPhone(lead.phone));
      }
      if (mode === "all") return true;
      if (state && !text(lead.location_preference).includes(state)) return false;
      if (interest && ![lead.purpose, lead.property_type, lead.property_interest].map(text).join(" ").includes(interest)) return false;
      const budget = money(lead.budget);
      if (budgetMin && (!budget || budget < budgetMin)) return false;
      if (budgetMax && (!budget || budget > budgetMax)) return false;
      return true;
    });

    const matchedPhones = new Set(matchedRecipients.map((lead) => normalizeLeadPhone(lead.phone)).filter(Boolean));
    if (mode === "group" && campaignGroup?.groupType === "manual") {
      for (const phone of groupPhones) {
        if (matchedPhones.has(phone)) continue;
        matchedRecipients.push({ id: phone, name: "there", phone, status: "new", score: "unscored", source: "manual_campaign_group", campaign_eligible: true } as ProgressiveLead);
        matchedPhones.add(phone);
      }
    }

    const cooldowns = await getMetaCooldownPhones(matchedRecipients.map((lead) => lead.phone), 24);
    const recipients = matchedRecipients.filter((lead) => !cooldowns.has(normalizeLeadPhone(lead.phone)));
    const cooldownSkipped = matchedRecipients.length - recipients.length;
    if (!recipients.length) return NextResponse.json({ error: cooldownSkipped ? "All matched leads are currently in WhatsApp cooldown after Meta delivery blocks. Wait before retrying or ask the contact to message Maia first." : "No campaign-eligible leads matched this audience.", skipped: cooldownSkipped, cooldownSkipped }, { status: 400 });

    await repairMaiaActionWorkflowInput();
    await repairMaiaCampaignFormatting();

    const campaignId = requestId;
    const createdBy = String((session as { email?: string; id?: string }).email || (session as { id?: string }).id || "admin");
    const reports: Array<Record<string, unknown>> = [];
    let sent = 0;
    let delivered = 0;
    let pendingDelivery = 0;
    let failed = 0;

    for (const lead of recipients) {
      try {
        const firstName = String(lead.name || "there").trim().split(/\s+/)[0] || "there";
        // Update v2 contract: {{1}} first name, {{2}} main update, {{3}} supporting paragraph, {{4}} response prompt.
        // The gateway receives the single campaign message and builds the exact template parameters.
        const dispatch = await dispatchMaiaCampaignAction({
          phone: lead.phone,
          leadId: String(lead.id),
          campaignId,
          topic,
          message: messageParts.join("\n\n"),
          templateName,
          campaignType,
          firstName,
          mediaUrl: "",
          metadata: {
            source: "limitless_campaign_center",
            template: templateName,
            mediaUrl: String(body.mediaUrl || "").trim(),
            mediaMode: "link_only",
          },
        });
        sent += 1;
        if (dispatch.delivered) delivered += 1; else pendingDelivery += 1;
        reports.push({ leadId: lead.id, phone: lead.phone, status: dispatch.delivered ? "delivered" : "sent", error: null });
      } catch (error) {
        failed += 1;
        const detail = error instanceof Error ? error.message : String(error || "Campaign delivery failed.");
        reports.push({ leadId: lead.id, phone: lead.phone, status: "failed", error: detail });
      }
    }

    await saveCampaignDeliveryReport({ campaignId, campaignType, templateName, topic, createdBy, attempted: recipients.length, sent, delivered, pendingDelivery, failed, skipped: cooldownSkipped, reports });

    const payload: Record<string, unknown> = {
      status: failed === recipients.length ? "failed" : failed ? "partial_failure" : "sent",
      attempted: recipients.length,
      sent,
      delivered,
      pendingDelivery,
      failed,
      skipped: cooldownSkipped,
      templateName,
      errors: reports.filter((report) => report.status === "failed").map((report) => ({ leadId: report.leadId, phone: report.phone, error: report.error })),
    };
    requestCache.set(requestId, { expiresAt: Date.now() + 10 * 60 * 1000, payload });
    return NextResponse.json(payload, { status: failed === recipients.length ? 502 : 200 });
  } catch (error) {
    if (error instanceof PropertyCampaignMessageError) return NextResponse.json({ error: error.message }, { status: 400 });
    const detail = error instanceof Error ? error.message : String(error || "Campaign failed.");
    console.error("Limitless campaign send failed", error);
    return NextResponse.json({ error: detail, reason: detail }, { status: 500 });
  }
}
