import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { claimOutboundTracking, updateOutboundTracking } from "@/lib/real-estate-campaign-delivery";
import { followupErrorSummary, followupOutboundIdempotencyKey } from "@/lib/limitless-followup-contract";
import { computeSequenceStepDueAt, resolveFollowUpPolicy } from "@/lib/follow-up-policy";
import { getRealEstateDirectWindowLastInboundAt } from "@/lib/real-estate-customer-service-window";

export const dynamic = "force-dynamic";
const LIMITLESS_REALTY_SLUG = "limitless-realty";
const FOLLOWUP_TEMPLATE_PURPOSE = "follow_up_outside_24h";
const DAY_30_STAGE = 6;
const LIMITLESS_APPROVED_FOLLOWUP_VARIABLE_ORDER = [
  "customer_name",
  "last_topic",
  "property_name",
  "property_location",
  "customer_interest",
  "customer_goal",
  "objection",
] as const;

function explicitlyRejectedByProvider(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; response?: unknown };
  const response = candidate.response && typeof candidate.response === "object" ? candidate.response as { status?: unknown } : {};
  const status = typeof candidate.status === "number" ? candidate.status : response.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408;
}

type FollowupLead = {
  phone?: string | null;
  name?: string | null;
  opted_out?: boolean | null;
} | null;

type FollowupRow = {
  id: string;
  organization_id: string;
  lead_id: string;
  customer_id: string | null;
  property_id: string | null;
  sequence_id: string | null;
  sequence_key: string | null;
  sequence_step_key: string | null;
  attempt_count: number | null;
  created_at: string | null;
  scheduled_at: string;
  due_at: string | null;
  sent_at: string | null;
  message_sent: string | null;
  last_error: string | null;
  status: string;
  template_name: string | null;
  stage: number;
  consent_state: string | null;
  consent_at?: string | null;
  consent_source?: string | null;
  consent_actor?: string | null;
  leads?: FollowupLead | FollowupLead[];
};

type SuccessfulTracking = {
  provider_message_id?: string | null;
  lifecycle_status?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && supplied && supplied === secret) return true;
  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();
  if (!schedulerToken) return false;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_maia_scheduler_secret", { candidate: schedulerToken });
  return !error && data === true;
}

function isUniqueViolation(error: unknown) {
  return String((error as { code?: string } | null)?.code || "") === "23505";
}

function sentAtFromTracking(row: FollowupRow, tracking: SuccessfulTracking) {
  const metadataSentAt = tracking.metadata && typeof tracking.metadata.sent_at === "string" ? tracking.metadata.sent_at : null;
  const value = row.sent_at || metadataSentAt || new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Provider-confirmed send has an invalid sent_at timestamp.");
  return parsed.toISOString();
}

async function queueNextNurtureStep(admin: ReturnType<typeof createAdminClient>, row: FollowupRow, sentAt: string) {
  if (!row.sequence_id || !row.customer_id || row.stage < DAY_30_STAGE) return null;
  const sentTime = new Date(sentAt).getTime();
  if (!Number.isFinite(sentTime)) throw new Error("Cannot schedule nurture without a valid sent_at timestamp.");
  let sequenceQuery = admin.from("limitless_maia_followup_sequences")
    .select("id,status,consent_state")
    .eq("organization_id", row.organization_id)
    .eq("id", row.sequence_id)
    .eq("customer_id", row.customer_id);
  sequenceQuery = row.property_id ? sequenceQuery.eq("property_id", row.property_id) : sequenceQuery.is("property_id", null);
  const { data: sequence, error: sequenceError } = await sequenceQuery.maybeSingle();
  if (sequenceError) throw sequenceError;
  if (!sequence || !["active", "paused"].includes(sequence.status) || sequence.consent_state !== "opted_in") return null;
  const policy = await resolveFollowUpPolicy(row.organization_id, LIMITLESS_REALTY_SLUG);
  const nurturePolicy = { ...policy, sequence: [{ step: 1, day: 15 }] };
  const dueAt = computeSequenceStepDueAt(nurturePolicy, sentAt, 1);
  if (!dueAt) throw new Error("The active Limitless policy could not schedule the 14-day nurture step.");
  const sequenceStepKey = `nurture:${row.id}`;
  const payload = {
    organization_id: row.organization_id,
    lead_id: row.lead_id,
    customer_id: row.customer_id,
    property_id: row.property_id,
    sequence_id: row.sequence_id,
    sequence_key: row.sequence_key,
    sequence_step_key: sequenceStepKey,
    stage: row.stage + 1,
    scheduled_at: dueAt,
    due_at: dueAt,
    message_sent: "Nurture check-in for the same verified property enquiry. Continue the active Limitless Realty customer/property sequence.",
    status: sequence.status === "paused" ? "paused" : "pending",
    channel: "whatsapp",
    agent_key: "maia",
    template_name: FOLLOWUP_TEMPLATE_PURPOSE,
    consent_state: "opted_in",
    consent_at: row.consent_at || null,
    consent_source: row.consent_source || null,
    consent_actor: row.consent_actor || null,
  };
  const inserted = await admin.from("follow_ups").insert(payload).select("id,scheduled_at,due_at,status,sequence_id,sequence_step_key,stage").maybeSingle();
  if (!inserted.error && inserted.data) return inserted.data;
  if (!isUniqueViolation(inserted.error)) throw inserted.error || new Error("Unable to create the next nurture step.");

  const existing = await admin.from("follow_ups")
    .select("id,scheduled_at,due_at,status,sequence_id,sequence_step_key,stage")
    .eq("organization_id", row.organization_id)
    .eq("sequence_id", row.sequence_id)
    .eq("sequence_step_key", sequenceStepKey)
    .maybeSingle();
  if (existing.error) throw existing.error;
  return existing.data || null;
}

async function confirmSuccessfulFollowup(admin: ReturnType<typeof createAdminClient>, row: FollowupRow, claimToken: string, sentAt: string) {
  const completed = await admin.from("follow_ups")
    .update({ status: "sent", sent_at: sentAt, completed_at: sentAt, last_error: null })
    .eq("id", row.id)
    .eq("organization_id", row.organization_id)
    .eq("customer_id", row.customer_id || "")
    .eq("sequence_id", row.sequence_id || "")
    .eq("claim_token", claimToken)
    .eq("status", "processing")
    .select("id,status,sent_at")
    .maybeSingle();
  if (completed.error) throw completed.error;
  if (!completed.data) throw new Error("Provider-confirmed follow-up could not be marked sent.");
  return queueNextNurtureStep(admin, row, sentAt);
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id").eq("slug", LIMITLESS_REALTY_SLUG).maybeSingle();
  if (!organization) return NextResponse.json({ error: "Limitless Realty organization is not configured." }, { status: 500 });
  try {
    await assertFluxFeatureAccess(organization.id, "follow_ups");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Follow-up automation is not included in this plan." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("follow_ups")
    .select("id,organization_id,lead_id,customer_id,property_id,sequence_id,sequence_key,sequence_step_key,attempt_count,created_at,scheduled_at,due_at,sent_at,message_sent,last_error,status,template_name,stage,consent_state,consent_at,consent_source,consent_actor,leads!follow_ups_lead_id_fkey(phone,name,opted_out)")
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .not("sequence_id", "is", null)
    .not("customer_id", "is", null)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(25);
  if (error) return NextResponse.json({ error: "Unable to load due follow-ups." }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  for (const rawRow of (rows || []) as FollowupRow[]) {
    const claimToken = randomUUID();
    if (!rawRow.customer_id || !rawRow.sequence_id || !rawRow.property_id) {
      await admin.from("follow_ups").update({ status: "unknown", last_error: "Canonical customer, property, and sequence identity are required." })
        .eq("id", rawRow.id).eq("organization_id", organization.id).eq("status", "pending");
      results.push({ status: "unknown", reason: "missing_sequence_identity" });
      continue;
    }
    const claim = await admin.rpc("claim_limitless_maia_followup_step", {
      p_organization_id: organization.id,
      p_customer_id: rawRow.customer_id,
      p_property_id: rawRow.property_id,
      p_sequence_id: rawRow.sequence_id,
      p_step_id: rawRow.id,
      p_lead_id: rawRow.lead_id,
      p_claim_token: claimToken,
    });
    const claimData = claim.data as { claimed?: boolean; attempt_count?: number; reason?: string } | null;
    if (claim.error || claimData?.claimed !== true) {
      if (claim.error) results.push({ status: "failed", reason: "claim_unavailable" });
      continue;
    }
    const attemptNumber = Number(claimData.attempt_count || 0);
    const outboundIdempotencyKey = followupOutboundIdempotencyKey({
      organizationId: organization.id,
      sequenceId: rawRow.sequence_id,
      stepId: rawRow.id,
      attempt: attemptNumber,
      lastError: rawRow.last_error,
    });

    const leadValue = rawRow.leads;
    const lead: FollowupLead = Array.isArray(leadValue) ? leadValue[0] || null : leadValue || null;
    const phone = String(lead?.phone || "").replace(/[^\d]/g, "");
    const scope = {
      organization_id: organization.id,
      customer_id: rawRow.customer_id,
      property_id: rawRow.property_id,
      sequence_id: rawRow.sequence_id,
      step_id: rawRow.id,
    };

    let providerMessageId: string | null = null;
    let providerSentAt: string | null = null;
    try {
      if (!rawRow.customer_id || !rawRow.sequence_id) {
        await admin.from("follow_ups").update({ status: "unknown", last_error: "Missing canonical customer or sequence identity." }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ id: rawRow.id, status: "unknown", reason: "missing_sequence_identity", scope });
        continue;
      }

      const { data: sequence, error: sequenceError } = await admin.from("limitless_maia_followup_sequences")
        .select("id,status,consent_state,property_id,lead_id,consent_at,consent_source,consent_actor")
        .eq("organization_id", organization.id)
        .eq("id", rawRow.sequence_id)
        .eq("customer_id", rawRow.customer_id)
        .maybeSingle();
      if (sequenceError) throw sequenceError;
      if (!sequence || sequence.property_id !== rawRow.property_id || sequence.lead_id !== rawRow.lead_id) {
        await admin.from("follow_ups").update({ status: "unknown", last_error: "Sequence identity could not be confirmed." }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ id: rawRow.id, status: "unknown", reason: "missing_sequence", scope });
        continue;
      }
      if (sequence.status === "paused") {
        await admin.from("follow_ups").update({ status: "paused", control_reason: "sequence_paused" }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ id: rawRow.id, status: "paused", reason: "sequence_paused", scope });
        continue;
      }
      if (sequence.status === "opted_out" || lead?.opted_out || sequence.consent_state === "opted_out" || rawRow.consent_state === "opted_out") {
        const nowOptedOut = new Date().toISOString();
        await admin.from("limitless_maia_followup_sequences").update({ status: "opted_out", consent_state: "opted_out", stopped_at: nowOptedOut, stop_reason: "customer_opted_out", stop_actor: `customer:${rawRow.customer_id}`, updated_at: nowOptedOut }).eq("organization_id", organization.id).eq("id", rawRow.sequence_id).eq("customer_id", rawRow.customer_id).in("status", ["active", "paused"]);
        await admin.from("follow_ups").update({ status: "cancelled", control_reason: "customer_opted_out", control_actor: `customer:${rawRow.customer_id}` }).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).in("status", ["pending", "scheduled", "queued", "processing", "paused"]).is("send_authorized_at", null);
        results.push({ id: rawRow.id, status: "cancelled", reason: "customer_opted_out", scope });
        continue;
      }
      if (sequence.consent_state !== "opted_in" || !sequence.consent_at || !sequence.consent_source || !sequence.consent_actor || rawRow.consent_state !== "opted_in") {
        const nowConsentUnknown = new Date().toISOString();
        await admin.from("limitless_maia_followup_sequences").update({ status: "stopped", consent_state: "unknown", stopped_at: nowConsentUnknown, stop_reason: "consent_missing", stop_actor: "system:followup-consent-guard", updated_at: nowConsentUnknown }).eq("organization_id", organization.id).eq("id", rawRow.sequence_id).eq("customer_id", rawRow.customer_id).eq("status", "active");
        await admin.from("follow_ups").update({ status: "cancelled", control_reason: "consent_missing", control_actor: "system:followup-consent-guard" }).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).in("status", ["pending", "scheduled", "queued", "processing", "paused"]).is("send_authorized_at", null);
        results.push({ id: rawRow.id, status: "cancelled", reason: "consent_missing", scope });
        continue;
      }
      if (["stopped", "closed", "completed"].includes(String(sequence.status))) {
        await admin.from("follow_ups").update({ status: "cancelled", control_reason: "admin_stop_or_close" }).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).in("status", ["pending", "scheduled", "queued", "processing", "paused"]).is("send_authorized_at", null);
        results.push({ id: rawRow.id, status: "cancelled", reason: "admin_stop_or_close", scope });
        continue;
      }
      if (sequence.status !== "active") {
        await admin.from("follow_ups").update({ status: "unknown", last_error: `Sequence is not sendable: ${sequence.status}` }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ id: rawRow.id, status: "unknown", reason: "sequence_not_sendable", scope });
        continue;
      }
      if (!phone) {
        await admin.from("follow_ups").update({ status: "unknown", last_error: "Missing WhatsApp phone; ambiguous delivery is not retried automatically." }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ id: rawRow.id, status: "unknown", reason: "missing_phone", scope });
        continue;
      }

      if (!rawRow.property_id) {
        await admin.from("follow_ups").update({ status: "unknown", last_error: "A tenant-verified property is required for this follow-up sequence." }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ id: rawRow.id, status: "unknown", reason: "missing_property_identity", scope });
        continue;
      }
      const { data: property, error: propertyError } = await admin.from("properties")
        .select("id,title,location_area,location_city")
        .eq("organization_id", organization.id)
        .eq("id", rawRow.property_id)
        .maybeSingle();
      if (propertyError) throw propertyError;
      if (!property) {
        await admin.from("follow_ups").update({ status: "unknown", last_error: "The follow-up property is not available in the active organization." }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ id: rawRow.id, status: "unknown", reason: "property_not_found_in_organization", scope });
        continue;
      }

      const tracking = await claimOutboundTracking(admin, {
        organizationId: organization.id,
        outboundKind: "followup",
        idempotencyKey: outboundIdempotencyKey,
        followUpId: rawRow.id,
        leadId: rawRow.lead_id,
        recipient: phone,
        lifecycleStatus: "approved",
        metadata: { sequence_id: rawRow.sequence_id, customer_id: rawRow.customer_id, property_id: rawRow.property_id, stage: rawRow.stage },
      });
      if (tracking.duplicate) {
        const existing = tracking.row as SuccessfulTracking;
        if (existing.provider_message_id && ["executed", "received"].includes(String(existing.lifecycle_status))) {
          const sentAt = sentAtFromTracking(rawRow, existing);
          const next = await confirmSuccessfulFollowup(admin, rawRow, claimToken, sentAt);
          results.push({ id: rawRow.id, status: "sent", duplicatePrevented: true, providerMessageId: existing.provider_message_id, nextDueAt: next?.due_at || null, scope });
        } else {
          await admin.from("follow_ups").update({ status: "unknown", last_error: "Existing outbound attempt has ambiguous provider state; manual review required." }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).eq("claim_token", claimToken).eq("status", "processing");
          results.push({ id: rawRow.id, status: "unknown", duplicatePrevented: true, providerMessageId: existing.provider_message_id || null, scope });
        }
        continue;
      }

      const authorization = await admin.rpc("authorize_limitless_maia_followup_send", {
        p_organization_id: organization.id,
        p_customer_id: rawRow.customer_id,
        p_property_id: rawRow.property_id,
        p_sequence_id: rawRow.sequence_id,
        p_step_id: rawRow.id,
        p_lead_id: rawRow.lead_id,
        p_claim_token: claimToken,
      });
      const authorizationData = authorization.data as { authorized?: boolean; reason?: string; sequence_status?: string } | null;
      if (authorization.error) {
        await updateOutboundTracking(admin, organization.id, outboundIdempotencyKey, { lifecycle_status: "failed", delivery_status: "failed", error_message: "send_authorization_failed" }).catch(() => undefined);
        await admin.from("follow_ups").update({ status: "failed", last_error: "Send authorization failed before provider delivery; manual retry is safe." })
          .eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id)
          .eq("sequence_id", rawRow.sequence_id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ status: "failed", reason: "send_authorization_failed", scope });
        continue;
      }
      if (authorizationData?.authorized !== true) {
        const heldStatus = authorizationData?.sequence_status === "paused" ? "paused" : "cancelled";
        await updateOutboundTracking(admin, organization.id, outboundIdempotencyKey, { lifecycle_status: "failed", delivery_status: "failed", error_message: "sequence_not_sendable_before_provider_call" }).catch(() => undefined);
        await admin.from("follow_ups").update({ status: heldStatus, claim_token: null, claimed_at: null, control_reason: authorizationData?.reason || "sequence_not_sendable" })
          .eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id)
          .eq("sequence_id", rawRow.sequence_id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ status: heldStatus, reason: authorizationData?.reason || "sequence_not_sendable", scope });
        continue;
      }

      await updateOutboundTracking(admin, organization.id, outboundIdempotencyKey, { lifecycle_status: "executing", delivery_status: "unknown" });
      const lastCustomerMessageAt = await getRealEstateDirectWindowLastInboundAt(organization.id, lead?.phone || phone);
      const withinCustomerServiceWindow = Boolean(lastCustomerMessageAt);
      const propertyLocation = [property.location_area, property.location_city].filter(Boolean).join(", ").trim() || "Location details not listed";
      const delivery = await sendWhatsAppMessage({
        organizationId: organization.id,
        to: phone,
        text: String(rawRow.message_sent || ""),
        deliveryMode: withinCustomerServiceWindow ? "direct" : "template",
        lastCustomerMessageAt,
        templatePurpose: FOLLOWUP_TEMPLATE_PURPOSE,
        ...(!withinCustomerServiceWindow ? { strictTemplateContract: { approvedVariableOrder: LIMITLESS_APPROVED_FOLLOWUP_VARIABLE_ORDER } } : {}),
        variables: {
          customer_name: String(lead?.name || ""),
          last_topic: String(property.title || "your property enquiry"),
          property_name: String(property.title || "Property details"),
          property_location: propertyLocation,
          customer_interest: `Property enquiry: ${String(property.title || "property")}`,
          customer_goal: "Updated availability or help arranging a viewing",
          objection: "No objection recorded",
        },
      });
      providerMessageId = String(delivery.providerMessageId || "").trim() || null;
      if (!providerMessageId) {
        await updateOutboundTracking(admin, organization.id, outboundIdempotencyKey, { lifecycle_status: "unknown", delivery_status: "unknown", provider: delivery.provider });
        await admin.from("follow_ups").update({ status: "unknown", last_error: "Provider returned no message ID; ambiguous delivery is not retried automatically." }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id).eq("sequence_id", rawRow.sequence_id).eq("claim_token", claimToken).eq("status", "processing");
        results.push({ id: rawRow.id, status: "unknown", provider: delivery.provider, messageType: delivery.messageType, providerMessageId: null, scope });
        continue;
      }

      const sentAt = new Date().toISOString();
      providerSentAt = sentAt;
      await updateOutboundTracking(admin, organization.id, outboundIdempotencyKey, {
        lifecycle_status: "executed",
        delivery_status: "accepted",
        provider: delivery.provider,
        provider_message_id: providerMessageId,
        metadata: { sequence_id: rawRow.sequence_id, customer_id: rawRow.customer_id, property_id: rawRow.property_id, stage: rawRow.stage, sent_at: sentAt },
      });
      const next = await confirmSuccessfulFollowup(admin, rawRow, claimToken, sentAt);
      results.push({ id: rawRow.id, status: "sent", provider: delivery.provider, messageType: delivery.messageType, providerMessageId, nextDueAt: next?.due_at || null, scope });
    } catch (error) {
      const message = followupErrorSummary(error) || "Delivery failed; raw provider details are restricted.";
      if (providerMessageId && providerSentAt) {
        await updateOutboundTracking(admin, organization.id, outboundIdempotencyKey, { lifecycle_status: "executed", delivery_status: "accepted", provider_message_id: providerMessageId, metadata: { sequence_id: rawRow.sequence_id, customer_id: rawRow.customer_id, property_id: rawRow.property_id, stage: rawRow.stage, sent_at: providerSentAt } }).catch(() => undefined);
        await admin.from("follow_ups").update({ status: "pending", claim_token: null, last_error: `Provider-confirmed send requires persistence retry: ${message}` }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id || "").eq("sequence_id", rawRow.sequence_id || "").in("status", ["processing", "sent"]);
        results.push({ id: rawRow.id, status: "sent", persistenceRetry: true, providerMessageId, error: message, scope });
        continue;
      }
      const status = explicitlyRejectedByProvider(error) ? "failed" : "unknown";
      await updateOutboundTracking(admin, organization.id, outboundIdempotencyKey, { lifecycle_status: status, delivery_status: status, error_message: message }).catch(() => undefined);
      await admin.from("follow_ups").update({ status, last_error: message }).eq("id", rawRow.id).eq("organization_id", organization.id).eq("customer_id", rawRow.customer_id || "").eq("sequence_id", rawRow.sequence_id || "").eq("claim_token", claimToken).eq("status", "processing");
      results.push({ id: rawRow.id, status, error: message, scope });
    }
  }

  const statusCounts = results.reduce<Record<string, number>>((counts, result) => {
    const status = String(result.status || "unknown");
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  return NextResponse.json({ ok: true, processed: results.length, status_counts: statusCounts });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
