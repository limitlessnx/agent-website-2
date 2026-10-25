import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { createHash } from "node:crypto";
import { getCampaignAudienceLeads, normalizeLeadPhone, saveProgressiveLead, type ProgressiveLead } from "@/lib/lead-profile-service";
import { getProperties } from "@/lib/limitless-data";
import { buildPropertyCampaignContent } from "@/lib/property-campaign-message";
import { getMetaCooldownPhones } from "@/lib/whatsapp-status-log";
import { diagnoseLimitlessCampaign } from "@/lib/leo-limitless-diagnostics";
import { LIMITLESS_REALTY_ORGANIZATION_ID, LIMITLESS_REALTY_SLUG } from "@/lib/leo-action-approval";

const UPDATE_TEMPLATE = "limitless_realty_update_v2";

/** Resolve the current admin workspace and refuse every fallback tenant. */
export async function requireLimitlessScope(requestedOrganizationId?: unknown) {
  const scope = await resolveAdminOrganizationScope();
  if (scope.kind !== "system" || scope.systemId !== "limitless-realty" || scope.organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID || scope.slug !== LIMITLESS_REALTY_SLUG) {
    throw new Error("Switch to the verified Limitless Realty workspace before executing this action.");
  }
  const requestedValue = requestedOrganizationId && typeof requestedOrganizationId === "object" ? (requestedOrganizationId as Record<string, unknown>).organization_id || (requestedOrganizationId as Record<string, unknown>).organizationId : requestedOrganizationId;
  const requested = text(requestedValue);
  if (requested && requested !== LIMITLESS_REALTY_ORGANIZATION_ID) throw new Error("The requested organization is outside the verified Limitless Realty workspace.");
  return scope;
}
function text(value: unknown) { return String(value || "").trim(); }
function lower(value: unknown) { return text(value).toLowerCase(); }
function money(value: unknown) { const parsed = Number(String(value || "").replace(/[^\d.]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function contactable(lead: ProgressiveLead) { const status = lower(lead.status); return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status)); }
function safeLead(lead: ProgressiveLead) { return { id: String(lead.id), name: lead.name, phone: lead.phone, email: lead.email || null, status: lead.status, score: lead.score || null, budget: lead.budget || null, locationPreference: lead.location_preference || null, propertyInterest: lead.property_interest || null, profileStatus: lead.profile_status || null, campaignEligible: lead.campaign_eligible !== false }; }
function matchesAudience(lead: ProgressiveLead, args: Record<string, unknown>) { const state = lower(args.state || args.location || args.location_preference); const interest = lower(args.interest || args.property_interest || args.property || args.property_name); const status = lower(args.status || args.lead_status); const budgetMin = money(args.budget_min || args.budgetMin); const budgetMax = money(args.budget_max || args.budgetMax); if (state && !lower(lead.location_preference).includes(state)) return false; if (interest && ![lead.property_interest, lead.property_type, lead.purpose].map(lower).join(" ").includes(interest)) return false; if (status && lower(lead.status) !== status) return false; const budget = money(lead.budget); if (budgetMin && (!budget || budget < budgetMin)) return false; if (budgetMax && (!budget || budget > budgetMax)) return false; return true; }
function audienceDescription(args: Record<string, unknown>) { const filters = [text(args.state || args.location || args.location_preference) ? `location=${text(args.state || args.location || args.location_preference)}` : "", text(args.interest || args.property_interest || args.property || args.property_name) ? `interest=${text(args.interest || args.property_interest || args.property || args.property_name)}` : "", text(args.status || args.lead_status) ? `status=${text(args.status || args.lead_status)}` : "", money(args.budget_min || args.budgetMin) ? `budget>=${money(args.budget_min || args.budgetMin)}` : "", money(args.budget_max || args.budgetMax) ? `budget<=${money(args.budget_max || args.budgetMax)}` : ""].filter(Boolean); return filters.length ? filters.join(", ") : "all eligible Limitless Realty leads"; }
function stableHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24); }
function preparedToken(input: { recipientIds: string[]; message: string; propertyId: string | null; audience: string }) { return `lrp_${stableHash({ ...input, recipientIds: [...input.recipientIds].sort(), template: UPDATE_TEMPLATE })}`; }
function stableExecutionId(sessionId: string, toolKey: string, args: Record<string, unknown>) { const cleaned = { ...args }; delete cleaned.request_id; delete cleaned.requestId; delete cleaned.confirmed; return `leo_${stableHash({ sessionId, toolKey, args: cleaned })}`; }
export function ensureLimitlessExecutionId(args: Record<string, unknown>, sessionId: string, toolKey: string) { return text(args.request_id || args.requestId) || stableExecutionId(sessionId || "no_session", toolKey, args); }

function requestsCampaignDiagnosis(args: Record<string, unknown>) {
  if (args.campaign_diagnosis === true || args.diagnose_campaign === true || args.delivery_report === true) return true;
  if (args.campaign_id || args.campaignId || args.execution_id || args.executionId) return true;
  const query = lower(args.query || args.request || args.intent || args.operation);
  return /campaign|delivery|delivered|failed|whatsapp report|message status/.test(query);
}

export async function findLimitlessLeads(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { organizationId } = await requireLimitlessScope(args);
  if (requestsCampaignDiagnosis(args)) return diagnoseLimitlessCampaign({ ...args, organization_id: organizationId });
  const leads = await getCampaignAudienceLeads(organizationId, 10000);
  const explicitId = text(args.lead_id || args.id);
  const query = lower(args.query || args.lead || args.name || args.phone || args.email || explicitId);
  const searched = explicitId ? leads.filter((lead) => String(lead.id) === explicitId) : query ? leads.filter((lead) => [lead.name, lead.phone, lead.email].some((value) => lower(value).includes(query))) : leads;
  const matches = searched.filter((lead) => matchesAudience(lead, args));
  return { ok: true, workspace: "Limitless Realty", query: query || null, audience: audienceDescription(args), count: matches.length, leads: matches.slice(0, 20).map(safeLead) };
}
export async function saveLimitlessLead(args: Record<string, unknown>) { const { organizationId } = await requireLimitlessScope(args); const name = text(args.name || args.full_name || args.contact_name); const phone = text(args.phone || args.whatsapp || args.whatsapp_number); if (!name) throw new Error("Lead name is required before Leo can save the contact."); if (!phone) throw new Error("Lead phone number is required before Leo can save the contact."); const saved = await saveProgressiveLead(organizationId, { name, phone, email: text(args.email) || undefined, status: text(args.status || args.lead_status) || "new", score: text(args.score) || undefined, budget: text(args.budget) || undefined, location_preference: text(args.location_preference || args.location || args.state) || undefined, property_type: text(args.property_type) || undefined, property_interest: text(args.property_interest || args.interest || args.property_name) || undefined, purpose: text(args.purpose) || undefined, notes: text(args.notes) || undefined, source: "super_leo_voice", campaign_eligible: args.campaign_eligible !== false }); const lead = saved[0]; return { ok: true, status: "saved", workspace: "Limitless Realty", lead: lead ? safeLead(lead) : { name, phone: normalizeLeadPhone(phone) } }; }
async function resolveLead(args: Record<string, unknown>) { const { organizationId } = await requireLimitlessScope(args); const result = await findLimitlessLeads({ ...args, campaign_diagnosis: false, diagnose_campaign: false, delivery_report: false, campaign_id: undefined, campaignId: undefined, execution_id: undefined, executionId: undefined }); const count = typeof result.count === "number" ? result.count : 0; const leads = Array.isArray(result.leads) ? result.leads.filter((lead): lead is Record<string, unknown> => Boolean(lead && typeof lead === "object" && !Array.isArray(lead))) : []; if (count === 0) throw new Error("No Limitless Realty lead matched that search."); if (count > 1) throw new Error("More than one Limitless Realty lead matched. Narrow the lead by name, phone, email or exact ID before preparing a send."); const id = String(leads[0]?.id || ""); const allLeads = await getCampaignAudienceLeads(organizationId, 10000); const lead = allLeads.find((item) => String(item.id) === id); if (!lead) throw new Error("The selected Limitless Realty lead could not be reloaded."); return lead; }
async function resolveMessage(args: Record<string, unknown>) {
  const { organizationId } = await requireLimitlessScope(args);
  const original = text(args.message || args.update || args.content);
  const propertyId = text(args.property_id || args.propertyId);
  if (text(args.media_url || args.mediaUrl)) throw new Error("Media attachments are not enabled by the verified Limitless Realty campaign template.");
  if (!propertyId) {
    if (!original) throw new Error("An update message or property ID is required before Leo can prepare the approved Limitless Realty template.");
    return { message: original, propertyId: null, propertyName: null };
  }
  const properties = (await getProperties(500, organizationId)).filter((item) => item.organization_id === organizationId);
  const property = properties.find((item) => String(item.id) === propertyId || lower(item.title) === lower(propertyId));
  if (!property) throw new Error("That Limitless Realty property could not be found in the active organization.");
  const content = buildPropertyCampaignContent(property, original, "");
  return { message: content.message, propertyId: property.id, propertyName: content.propertyName };
}
function templatePreview(message: string, leadName = "there") { const paragraphs = message.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean); return { templateName: UPDATE_TEMPLATE, bodyParameters: [leadName || "there", paragraphs[0] || message.trim(), paragraphs[1] || "", paragraphs[2] || ""], exactTemplateRule: "Approved Meta template with exactly four BODY variables and no URL button or media component. The message body is not regenerated during delivery." }; }

export async function prepareLimitlessFollowup(args: Record<string, unknown>) { const lead = await resolveLead(args); if (!contactable(lead)) throw new Error("That lead is not currently eligible for campaign messaging."); const message = await resolveMessage(args); const cooldowns = await getMetaCooldownPhones([lead.phone], 24); const inCooldown = cooldowns.has(normalizeLeadPhone(lead.phone)); const audience = `lead=${lead.id}`; const token = preparedToken({ recipientIds: [String(lead.id)], message: message.message, propertyId: message.propertyId, audience }); return { ok: true, status: "prepared", workspace: "Limitless Realty", mode: "single_lead", recipient: safeLead(lead), eligibleToSendNow: !inCooldown, cooldownBlocked: inCooldown, message: message.message, propertyId: message.propertyId, propertyName: message.propertyName, preview: templatePreview(message.message, lead.name), preparedToken: token, lockedRecipientIds: [String(lead.id)], requiresApprovalToSend: true }; }
export async function prepareLimitlessCampaign(args: Record<string, unknown>) { const { organizationId } = await requireLimitlessScope(args); const leads = await getCampaignAudienceLeads(organizationId, 10000); const matched = leads.filter((lead) => contactable(lead) && matchesAudience(lead, args)); const cooldowns = await getMetaCooldownPhones(matched.map((lead) => lead.phone), 24); const recipients = matched.filter((lead) => !cooldowns.has(normalizeLeadPhone(lead.phone))); if (!recipients.length) throw new Error("No eligible Limitless Realty recipients matched that audience."); const message = await resolveMessage(args); const audience = audienceDescription(args); const ids = recipients.map((lead) => String(lead.id)); const token = preparedToken({ recipientIds: ids, message: message.message, propertyId: message.propertyId, audience }); return { ok: true, status: "prepared", workspace: "Limitless Realty", mode: "filtered_eligible_leads", audience, templateName: UPDATE_TEMPLATE, matched: matched.length, eligibleNow: recipients.length, cooldownSkipped: matched.length - recipients.length, sampleRecipients: recipients.slice(0, 5).map(safeLead), message: message.message, propertyId: message.propertyId, propertyName: message.propertyName, preview: templatePreview(message.message, recipients[0]?.name || "there"), preparedToken: token, lockedRecipientIds: ids, requiresApprovalToSend: true }; }

async function validatePreparedSend(args: Record<string, unknown>, selectedLeadId?: string) {
  const { organizationId } = await requireLimitlessScope(args);
  const suppliedToken = text(args.prepared_token || args.preparedToken);
  if (!suppliedToken) throw new Error("A preparedToken from the exact Limitless Realty audience preview is required before sending.");
  const message = await resolveMessage(args);
  const leads = await getCampaignAudienceLeads(organizationId, 10000);
  const matched = selectedLeadId ? leads.filter((lead) => String(lead.id) === selectedLeadId && contactable(lead)) : leads.filter((lead) => contactable(lead) && matchesAudience(lead, args));
  const cooldowns = await getMetaCooldownPhones(matched.map((lead) => lead.phone), 24);
  const ids = matched.filter((lead) => !cooldowns.has(normalizeLeadPhone(lead.phone))).map((lead) => String(lead.id));
  if (!ids.length) throw new Error("No eligible Limitless Realty recipients remain for this prepared audience.");
  const audience = selectedLeadId ? `lead=${selectedLeadId}` : audienceDescription(args);
  const expected = preparedToken({ recipientIds: ids, message: message.message, propertyId: message.propertyId, audience });
  if (expected !== suppliedToken) throw new Error("The prepared audience or message changed after approval. Leo must prepare the action again and request fresh confirmation before sending.");
  return { selectedIds: ids, tokenValidated: true };
}

export async function sendThroughLimitlessCampaignRoute(request: Request, args: Record<string, unknown>, selectedLeadId?: string) {
  const { organizationId } = await requireLimitlessScope(args);
  const message = text(args.message || args.update || args.content);
  const propertyId = text(args.property_id || args.propertyId);
  if (!message && !propertyId) throw new Error("An update message or property ID is required before sending.");
  const requestId = text(args.request_id || args.requestId) || crypto.randomUUID();
  const origin = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") || "";
  const state = text(args.state || args.location || args.location_preference);
  const interest = text(args.interest || args.property_interest || args.property || args.property_name);
  const status = text(args.status || args.lead_status);
  const prepared = await validatePreparedSend(args, selectedLeadId);
  const explicitSelected = prepared.selectedIds || (Array.isArray(args.selected_lead_ids) ? args.selected_lead_ids.map(String) : Array.isArray(args.selectedLeadIds) ? args.selectedLeadIds.map(String) : []);
  const hasFilters = Boolean(state || interest || status || money(args.budget_min || args.budgetMin) || money(args.budget_max || args.budgetMax));
  if (status && !selectedLeadId && !explicitSelected.length) {
    const leads = await getCampaignAudienceLeads(organizationId, 10000);
    const selectedLeadIds = leads.filter((lead) => contactable(lead) && matchesAudience(lead, args)).map((lead) => String(lead.id));
    if (!selectedLeadIds.length) throw new Error("No eligible Limitless Realty leads matched that audience.");
    return sendThroughLimitlessCampaignRoute(request, { ...args, selected_lead_ids: selectedLeadIds, status: "" }, undefined);
  }
  const payload = {
    organizationId, requestId, campaignType: "limitless_realty_update" as const,
    topic: text(args.topic) || (selectedLeadId ? "Limitless Realty follow-up" : "Limitless Realty Update"),
    message, propertyId: propertyId || undefined, mediaUrl: text(args.media_url || args.mediaUrl) || undefined,
    audienceMode: selectedLeadId || explicitSelected.length ? "manual" as const : hasFilters ? "filters" as const : "all" as const,
    selectedLeadIds: selectedLeadId ? [selectedLeadId] : explicitSelected.length ? explicitSelected : undefined,
    state: state || undefined, interest: interest || undefined,
    budgetMin: money(args.budget_min || args.budgetMin) || undefined,
    budgetMax: money(args.budget_max || args.budgetMax) || undefined,
  };
  const endpoint = `${origin}/api/limitless/campaigns/send`;
  const sendStep = async (approvalStage: "prepare" | "send", approval?: { approvalId: string; token: string }) => fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ ...payload, approvalStage, ...(approval ? { approvalId: approval.approvalId, approvalToken: approval.token } : {}) }),
    cache: "no-store",
  });
  const previewResponse = await sendStep("prepare");
  const preview = await previewResponse.json().catch(() => ({}));
  if (!previewResponse.ok || !preview.approval?.approvalId || !preview.approval?.token) throw new Error(String(preview.error || `Campaign preparation returned HTTP ${previewResponse.status}.`));
  const response = await sendStep("send", { approvalId: String(preview.approval.approvalId), token: String(preview.approval.token) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(result.error || result.reason || `Limitless Realty campaign returned HTTP ${response.status}.`));
  return { ...result, workspace: "Limitless Realty", audience: audienceDescription(args), authoritativeTemplate: UPDATE_TEMPLATE, preparedTokenValidated: prepared.tokenValidated };
}
export async function sendLimitlessFollowup(request: Request, args: Record<string, unknown>) { const lead = await resolveLead(args); if (!contactable(lead)) throw new Error("That lead is not currently eligible for campaign messaging."); return sendThroughLimitlessCampaignRoute(request, args, String(lead.id)); }
