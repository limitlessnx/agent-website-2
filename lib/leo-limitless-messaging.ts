import { getCampaignAudienceLeads, normalizeLeadPhone, type ProgressiveLead } from "@/lib/lead-profile-service";
import { getProperties } from "@/lib/limitless-data";
import { buildPropertyCampaignContent } from "@/lib/property-campaign-message";
import { getMetaCooldownPhones } from "@/lib/whatsapp-status-log";

const UPDATE_TEMPLATE = "limitless_realty_update_v2";

function text(value: unknown) { return String(value || "").trim(); }
function lower(value: unknown) { return text(value).toLowerCase(); }
function contactable(lead: ProgressiveLead) {
  const status = lower(lead.status);
  return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status));
}
function safeLead(lead: ProgressiveLead) {
  return {
    id: String(lead.id), name: lead.name, phone: lead.phone, email: lead.email || null,
    status: lead.status, score: lead.score || null, budget: lead.budget || null,
    locationPreference: lead.location_preference || null, propertyInterest: lead.property_interest || null,
    profileStatus: lead.profile_status || null, campaignEligible: lead.campaign_eligible !== false,
  };
}

export async function findLimitlessLeads(args: Record<string, unknown>) {
  const leads = await getCampaignAudienceLeads(10000);
  const query = lower(args.query || args.lead || args.name || args.phone || args.email || args.lead_id || args.id);
  const matches = query ? leads.filter((lead) => [lead.id, lead.name, lead.phone, lead.email].some((value) => lower(value).includes(query))) : leads;
  return { ok: true, workspace: "Limitless Realty", query: query || null, count: matches.length, leads: matches.slice(0, 20).map(safeLead) };
}

async function resolveLead(args: Record<string, unknown>) {
  const result = await findLimitlessLeads(args);
  if (result.count === 0) throw new Error("No Limitless Realty lead matched that search.");
  if (result.count > 1 && !text(args.lead_id || args.id)) throw new Error(`More than one Limitless Realty lead matched. Narrow the lead by name, phone, email or ID before preparing a send.`);
  const id = String(result.leads[0].id);
  const leads = await getCampaignAudienceLeads(10000);
  const lead = leads.find((item) => String(item.id) === id);
  if (!lead) throw new Error("The selected Limitless Realty lead could not be reloaded.");
  return lead;
}

async function resolveMessage(args: Record<string, unknown>) {
  const original = text(args.message || args.update || args.content);
  const propertyId = text(args.property_id || args.propertyId);
  if (!propertyId) {
    if (!original) throw new Error("An update message or property ID is required before Leo can prepare the approved Limitless Realty template.");
    return { message: original, propertyId: null, propertyName: null };
  }
  const properties = await getProperties(500);
  const property = properties.find((item) => String(item.id) === propertyId || lower(item.title) === lower(propertyId));
  if (!property) throw new Error("That Limitless Realty property could not be found.");
  const content = buildPropertyCampaignContent(property, original, text(args.media_url || args.mediaUrl));
  return { message: content.message, propertyId: property.id, propertyName: content.propertyName };
}

function templatePreview(message: string, leadName = "there") {
  const paragraphs = message.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return {
    templateName: UPDATE_TEMPLATE,
    bodyParameters: [leadName || "there", paragraphs[0] || message.trim(), paragraphs[1] || "", paragraphs[2] || ""],
    exactTemplateRule: "Approved Meta template with exactly four BODY variables and no URL button or media component. The message body is not regenerated during delivery.",
  };
}

export async function prepareLimitlessFollowup(args: Record<string, unknown>) {
  const lead = await resolveLead(args);
  if (!contactable(lead)) throw new Error("That lead is not currently eligible for campaign messaging.");
  const message = await resolveMessage(args);
  const cooldowns = await getMetaCooldownPhones([lead.phone], 24);
  const inCooldown = cooldowns.has(normalizeLeadPhone(lead.phone));
  return {
    ok: true, status: "prepared", workspace: "Limitless Realty", mode: "single_lead", recipient: safeLead(lead),
    eligibleToSendNow: !inCooldown, cooldownBlocked: inCooldown, message: message.message, propertyId: message.propertyId,
    propertyName: message.propertyName, preview: templatePreview(message.message, lead.name), requiresApprovalToSend: true,
  };
}

export async function prepareLimitlessCampaign(args: Record<string, unknown>) {
  const leads = await getCampaignAudienceLeads(10000);
  const eligible = leads.filter(contactable);
  const cooldowns = await getMetaCooldownPhones(eligible.map((lead) => lead.phone), 24);
  const recipients = eligible.filter((lead) => !cooldowns.has(normalizeLeadPhone(lead.phone)));
  const message = await resolveMessage(args);
  return {
    ok: true, status: "prepared", workspace: "Limitless Realty", mode: "all_eligible_leads", templateName: UPDATE_TEMPLATE,
    matched: eligible.length, eligibleNow: recipients.length, cooldownSkipped: eligible.length - recipients.length,
    sampleRecipients: recipients.slice(0, 5).map(safeLead), message: message.message, propertyId: message.propertyId,
    propertyName: message.propertyName, preview: templatePreview(message.message, recipients[0]?.name || "there"), requiresApprovalToSend: true,
  };
}

export async function sendThroughLimitlessCampaignRoute(request: Request, args: Record<string, unknown>, selectedLeadId?: string) {
  const message = text(args.message || args.update || args.content);
  const propertyId = text(args.property_id || args.propertyId);
  if (!message && !propertyId) throw new Error("An update message or property ID is required before sending.");
  const requestId = text(args.request_id || args.requestId) || crypto.randomUUID();
  const origin = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") || "";
  const payload = {
    requestId,
    campaignType: "limitless_realty_update",
    topic: text(args.topic) || (selectedLeadId ? "Limitless Realty follow-up" : "Limitless Realty Update"),
    message,
    propertyId: propertyId || undefined,
    mediaUrl: text(args.media_url || args.mediaUrl) || undefined,
    audienceMode: selectedLeadId ? "manual" : "all",
    selectedLeadIds: selectedLeadId ? [selectedLeadId] : undefined,
  };
  const response = await fetch(`${origin}/api/limitless/campaigns/send`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(payload), cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(result.error || result.reason || `Limitless Realty campaign returned HTTP ${response.status}.`));
  return { ...result, workspace: "Limitless Realty", authoritativeTemplate: UPDATE_TEMPLATE };
}

export async function sendLimitlessFollowup(request: Request, args: Record<string, unknown>) {
  const lead = await resolveLead(args);
  if (!contactable(lead)) throw new Error("That lead is not currently eligible for campaign messaging.");
  return sendThroughLimitlessCampaignRoute(request, args, String(lead.id));
}
