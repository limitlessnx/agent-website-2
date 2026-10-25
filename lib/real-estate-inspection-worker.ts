import { createAdminClient } from "@/lib/supabase/admin";
import { addCanonicalTimelineEvent } from "@/lib/canonical-customer";
import { preflightChargeableFluxAi, recordChargeableFluxAiUsage } from "@/lib/flux-ai-metering-core";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

const REMINDER_TYPES = new Set(["reminder_24h", "reminder_2h"]);
const OUTCOME_TYPES = new Set(["outcome_followup"]);
type Json = Record<string, unknown>;
type InspectionJob = { id: string; inspection_id?: string | null; job_type: string; payload?: unknown; created_at?: string | null };
type InspectionRow = { id: string; customer_id?: string | null; legacy_lead_id?: string | null; status: string; requested_start_at?: string | null };
type CustomerRow = { id: string; full_name?: string | null; phone?: string | null; metadata?: unknown };
type LegacyLeadRow = { id: string; phone?: string | null; opted_out?: unknown };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
function text(value: unknown, max = 1000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function record(value: unknown): Json { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {}; }
function bool(value: unknown) { return value === true || value === "true" || value === 1; }
function optionalText(value: unknown) { return typeof value === "string" ? value : null; }
function parseJob(value: unknown): InspectionJob | null {
  const row = record(value);
  if (typeof row.id !== "string" || typeof row.job_type !== "string") return null;
  return { id: row.id, inspection_id: optionalText(row.inspection_id), job_type: row.job_type, payload: row.payload, created_at: optionalText(row.created_at) };
}
function parseInspection(value: unknown): InspectionRow | null {
  const row = record(value);
  if (typeof row.id !== "string" || typeof row.status !== "string") return null;
  return { id: row.id, customer_id: optionalText(row.customer_id), legacy_lead_id: optionalText(row.legacy_lead_id), status: row.status, requested_start_at: optionalText(row.requested_start_at) };
}
function parseCustomer(value: unknown): CustomerRow | null {
  const row = record(value);
  return typeof row.id === "string" ? { id: row.id, full_name: optionalText(row.full_name), phone: optionalText(row.phone), metadata: row.metadata } : null;
}
function parseLegacyLead(value: unknown): LegacyLeadRow | null {
  const row = record(value);
  return typeof row.id === "string" ? { id: row.id, phone: optionalText(row.phone), opted_out: row.opted_out } : null;
}

async function verifiedRealEstateOrganization(organizationId: string) {
  if (!text(organizationId)) throw new Error("An explicit organizationId is required.");
  const { data, error } = await createAdminClient().from("organizations").select("id,slug,status,metadata").eq("id", organizationId).maybeSingle();
  if (error) throw error;
  const metadata = record(data?.metadata);
  const industry = text(metadata.industry_slug || metadata.industry).toLowerCase().replace(/[^a-z]/g, "");
  if (!data || data.status !== "active" || (data.slug !== "limitless-realty" && industry !== "realestate")) throw new Error("Inspection worker requires an active verified real-estate organization.");
  const setting = await createAdminClient().from("real_estate_inspection_automation").select("status").eq("organization_id",organizationId).maybeSingle();
  if (setting.error) throw setting.error;
  if (setting.data?.status !== "enabled") throw new Error("Inspection reminder automation is not explicitly enabled for this organization.");
  return data;
}

async function claimJob(organizationId: string) {
  const { data, error } = await (createAdminClient() as unknown as RpcClient).rpc("claim_real_estate_inspection_job", { p_organization_id: organizationId });
  if (error) throw error;
  const candidate = Array.isArray(data) ? data[0] : data;
  if (candidate === null || candidate === undefined) return null;
  const job = parseJob(candidate);
  if (!job) throw new Error("Inspection job claim returned an invalid job.");
  return job;
}

async function updateJob(organizationId: string, id: string, values: Record<string, unknown>) {
  const { data, error } = await createAdminClient().from("real_estate_inspection_jobs").update({ ...values, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", id).select("id,status,payload").single();
  if (error) throw error;
  return data;
}

async function cancelJob(organizationId: string, job: InspectionJob, reason: string) {
  return updateJob(organizationId, String(job.id), { status: "cancelled", payload: { ...record(job.payload), worker_status: "cancelled", suppression_reason: reason } });
}

async function loadInspectionContext(organizationId: string, inspectionId: string) {
  const client = createAdminClient();
  const { data: inspectionData, error } = await client.from("real_estate_inspections").select("*").eq("organization_id", organizationId).eq("id", inspectionId).maybeSingle();
  if (error) throw error;
  const inspection = parseInspection(inspectionData);
  if (!inspection) throw new Error("Inspection job references no inspection in this organization.");
  let customer: CustomerRow | null = null;
  if (inspection.customer_id) {
    const result = await client.from("crm_customers").select("id,full_name,phone,status,metadata,current_stage_id").eq("organization_id", organizationId).eq("id", inspection.customer_id).maybeSingle();
    if (result.error) throw result.error;
    customer = parseCustomer(result.data);
  }
  let legacyLead: LegacyLeadRow | null = null;
  if (inspection.legacy_lead_id) {
    const result = await client.from("leads").select("id,phone,opted_out,status,name").eq("organization_id", organizationId).eq("id", inspection.legacy_lead_id).maybeSingle();
    if (result.error) throw result.error;
    legacyLead = parseLegacyLead(result.data);
  }
  return { inspection, customer, legacyLead };
}

async function staleReason(organizationId: string, job: InspectionJob, context: { inspection: InspectionRow; customer: CustomerRow | null; legacyLead: LegacyLeadRow | null }) {
  const { inspection, customer, legacyLead } = context;
  const metadata = record(customer?.metadata);
  if (bool(legacyLead?.opted_out) || bool(metadata.opted_out || metadata.whatsapp_opted_out || metadata.do_not_contact)) return "customer_opted_out";
  if (["cancelled", "no_show", "completed", "failed"].includes(String(inspection.status)) && String(job.job_type) !== "outcome_followup") return "inspection_terminal";
  if (REMINDER_TYPES.has(String(job.job_type)) && !["booked", "rescheduled"].includes(String(inspection.status))) return "inspection_not_booked";
  if (REMINDER_TYPES.has(String(job.job_type)) && (!inspection.requested_start_at || new Date(inspection.requested_start_at).getTime() <= Date.now())) return "inspection_time_passed";
  if (OUTCOME_TYPES.has(String(job.job_type)) && !["completed", "no_show"].includes(String(inspection.status))) return "outcome_not_recorded";
  if (!customer?.id || !customer.phone) return "customer_contact_unavailable";

  const client = createAdminClient();
  const handoffs = await client.from("human_handoffs").select("id,status").eq("organization_id", organizationId).eq("customer_id", customer.id).not("status", "in", "(resolved,closed)").limit(1);
  if (handoffs.error) throw handoffs.error;
  if (handoffs.data?.length) return "active_handoff";
  const conversation = await client.from("crm_conversations").select("id,status,metadata").eq("organization_id", organizationId).eq("customer_id", customer.id).eq("channel", "whatsapp").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (conversation.error) throw conversation.error;
  if (conversation.data) {
    const conversationMetadata = record(conversation.data.metadata);
    if (conversation.data.status === "handoff" || bool(conversationMetadata.ai_paused || conversationMetadata.active_handoff_id)) return "active_handoff";
    const inbound = await client.from("crm_messages").select("id,created_at").eq("organization_id", organizationId).eq("conversation_id", conversation.data.id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (inbound.error) throw inbound.error;
    if (inbound.data?.created_at && job.created_at && new Date(inbound.data.created_at).getTime() > new Date(job.created_at).getTime()) return "customer_replied";
  }
  return null;
}

async function setOutcomeStage(organizationId: string, inspection: InspectionRow) {
  if (!inspection.customer_id) return null;
  const desiredKey = inspection.status === "completed" ? "negotiation" : "qualified";
  const client = createAdminClient();
  const stage = await client.from("organization_customer_stages").select("id,key,name").eq("organization_id", organizationId).eq("key", desiredKey).eq("status", "active").limit(1).maybeSingle();
  if (stage.error) throw stage.error;
  if (!stage.data?.id) return null;
  const update = await client.from("crm_customers").update({ current_stage_id: stage.data.id, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", inspection.customer_id);
  if (update.error) throw update.error;
  await addCanonicalTimelineEvent({
    organizationId, customerId: inspection.customer_id, eventType: `real_estate_inspection.${inspection.status}`,
    title: inspection.status === "completed" ? "Inspection follow-up accepted by provider" : "Inspection no-show follow-up accepted by provider",
    summary: inspection.status === "completed" ? "Inspection outcome recorded and the WhatsApp provider accepted the follow-up request." : "Inspection was recorded as a no-show and the WhatsApp provider accepted the follow-up request.",
    channel: "whatsapp", sourceTable: "real_estate_inspections", sourceId: inspection.id,
    actorType: "system", actorId: "real_estate_inspection_worker", metadata: { stage_id: stage.data.id, stage_key: desiredKey },
  });
  return stage.data;
}

function outcomeMessage(inspection: InspectionRow) {
  if (inspection.status === "no_show") return "We missed you for the property inspection. Reply here if you would like to choose another time.";
  return "Thank you for attending the property inspection. Reply here if you would like to discuss the property or next steps.";
}
function reminderMessage(inspection: InspectionRow, jobType: string) {
  const when = inspection.requested_start_at ? new Date(inspection.requested_start_at).toISOString() : "the scheduled time";
  return jobType === "reminder_24h" ? `Reminder: your property inspection is scheduled for ${when}.` : `Reminder: your property inspection is coming up at ${when}.`;
}

async function processClaimedJob(organizationId: string, job: InspectionJob) {
  const context = await loadInspectionContext(organizationId, text(job.inspection_id) || text(record(job.payload).inspection_id));
  const reason = await staleReason(organizationId, job, context);
  if (reason) {
    await cancelJob(organizationId, job, reason);
    return { jobId: job.id, status: "cancelled", reason };
  }
  const { inspection, customer } = context;
  if (!customer || !customer.phone) {
    const reason = "customer_contact_unavailable";
    await cancelJob(organizationId, job, reason);
    return { jobId: job.id, status: "cancelled", reason };
  }
  const jobType = String(job.job_type);
  await preflightChargeableFluxAi({ organizationId, feature: "reminders", action: "whatsapp_follow_up_reminder" });
  try {
    const result = await sendWhatsAppMessage({
      organizationId, to: String(customer.phone), text: OUTCOME_TYPES.has(jobType) ? outcomeMessage(inspection) : reminderMessage(inspection, jobType),
      deliveryMode: "auto", templatePurpose: "appointment_reminder",
      variables: { customer_name: String(customer.full_name || ""), inspection_time: String(inspection.requested_start_at || "") },
    });
    const providerMessageId = text(result?.providerMessageId, 300) || null;
    if (!providerMessageId) {
      await updateJob(organizationId, job.id, { status: "failed", payload: { ...record(job.payload), delivery_status: "unknown", manual_review_required: true, retry_safe: false, provider_message_id: null, delivery_error: "Provider accepted no identifiable message id." } });
      return { jobId: job.id, status: "unknown", manualReview: true };
    }
    await recordChargeableFluxAiUsage({ organizationId, action: "whatsapp_follow_up_reminder", source: "real_estate_inspection", provider: String(result?.provider || "whatsapp"), metadata: { inspection_id: inspection.id, job_id: job.id, provider_message_id: providerMessageId } });
    const deliveryStatus = "accepted"; // Submission acknowledgement is not a delivery receipt.
    const provider=String(result?.provider||"meta");
    await updateJob(organizationId, job.id, { status: "completed", provider, provider_message_id: providerMessageId, delivery_status: deliveryStatus, delivery_status_received_at:null, payload: { ...record(job.payload), provider, delivery_status: deliveryStatus, provider_message_id: providerMessageId, submitted_at: new Date().toISOString(), retry_safe: false } });
    if (OUTCOME_TYPES.has(jobType)) await setOutcomeStage(organizationId, inspection);
    return { jobId: job.id, status: "sent", providerMessageId };
  } catch (error) {
    const errorText = error instanceof Error ? error.message : "WhatsApp provider failure.";
    const providerError = record(error);
    const providerStatus = Number(providerError.status || 0);
    const noPossibleAcceptance = providerStatus >= 400 && providerStatus < 500;
    await updateJob(organizationId, job.id, { status: "failed", provider: String(providerError.provider||"meta"), provider_message_id: text(providerError.providerMessageId, 300) || null, delivery_status: noPossibleAcceptance ? "failed" : "unknown", provider_error_code:String(providerError.code||"")||null, provider_error_message:errorText.slice(0,1000), payload: { ...record(job.payload), delivery_status: noPossibleAcceptance ? "failed" : "unknown", provider_message_id: text(providerError.providerMessageId, 300) || null, delivery_error: errorText.slice(0, 1000), retry_safe: noPossibleAcceptance, manual_review_required: !noPossibleAcceptance } });
    return { jobId: job.id, status: noPossibleAcceptance ? "failed" : "unknown", manualReview: !noPossibleAcceptance, reason: errorText };
  }
}

export async function processDueRealEstateInspectionJobs(input: { organizationId: string; limit?: number }) {
  const organization = await verifiedRealEstateOrganization(input.organizationId);
  const limit = Math.max(1, Math.min(100, Number(input.limit) || 25));
  const results: unknown[] = [];
  for (let index = 0; index < limit; index += 1) {
    const job = await claimJob(String(organization.id));
    if (!job) break;
    try { results.push(await processClaimedJob(String(organization.id), job)); }
    catch (error) {
      const reason = error instanceof Error ? error.message : "Inspection worker failed.";
      await updateJob(String(organization.id), job.id, { status: "failed", payload: { ...record(job.payload), delivery_status: "unknown", delivery_error: reason.slice(0, 1000), retry_safe: false, manual_review_required: true } }).catch(() => undefined);
      results.push({ jobId: job.id, status: "unknown", manualReview: true, reason });
    }
  }
  return { organizationId: String(organization.id), processed: results.length, results };
}
