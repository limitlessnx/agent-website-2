import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { hotelConversationState } from "@/lib/hotel-communications";
import { withinWhatsAppWindow } from "@/lib/hotel-communication-policy";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { addCanonicalCrmMessage, getOrCreateCanonicalConversation } from "@/lib/canonical-customer";
import { currentCrmIdentity, validateCrmBindings } from "./authorization";
import { crmAction, crmTriggerEnabled, digest, executionResult, principal } from "./contract";
import { loadExecution, transition } from "./store";

export async function runCrmFollowup(executionId: string) {
  let row = await loadExecution(executionId);
  if (!["pending_dispatch", "queued"].includes(row.status)) return executionResult(row);
  // Claim is atomic across runs, retries, delayed delivery and Trigger TTL expiry.
  const claimed = await transition(row.id, ["pending_dispatch", "queued"], { status: "processing" });
  if (!claimed) return executionResult(await loadExecution(row.id));
  row = claimed;
  let enteredProvider = false;
  try {
    if (!crmTriggerEnabled()) throw new Error("Trigger.dev CRM follow-ups are disabled.");
    const deadline = Date.parse(row.authorized_until);
    if (!Number.isFinite(deadline) || Date.now() > deadline) throw new Error("CRM execution authorization expired.");
    const action = crmAction(row.arguments, row.organization_id);
    if (digest(action) !== row.action_digest || principal(row.identity) !== row.principal || row.identity.channel !== row.channel) throw new Error("CRM execution binding mismatch.");
    await currentCrmIdentity(row.identity, row.organization_id);
    const { data: approval, error } = await createAdminClient().from("leo_crm_approvals").select("*").eq("id", row.approval_id).single();
    if (error) throw error;
    if (!approval?.consumed_at || approval.execution_id !== row.id || approval.organization_id !== row.organization_id || approval.principal !== row.principal || approval.session_id !== row.session_id || approval.channel !== row.channel || approval.action_digest !== row.action_digest) throw new Error("A consumed, bound CRM approval is required at the worker.");
    const customer = await validateCrmBindings(action);
    await assertFluxFeatureAccess(row.organization_id, "follow_ups");
    // Use persisted inbound activity and handoff state, never a caller's timestamp.
    const state = await hotelConversationState(row.organization_id, action.customer_id);
    if (state.handoff || !withinWhatsAppWindow(state.lastInboundAt)) throw new Error("An open customer service window without human handoff is required.");
    const conversationId = await getOrCreateCanonicalConversation({ organizationId: row.organization_id, customerId: action.customer_id, channel: "whatsapp", agentId: action.agent_id });
    if (Date.now() > deadline) throw new Error("CRM execution authorization expired during preflight.");
    if (!await transition(row.id, ["processing"], { status: "sending" })) throw new Error("CRM execution claim lost.");
    enteredProvider = true;
    const delivery = await sendWhatsAppMessage({ organizationId: row.organization_id, to: customer.phone, text: action.message,
      deliveryMode: "direct", lastCustomerMessageAt: state.lastInboundAt,
      // Suppress implicit property-media lookup; only the approved text is sent.
      propertyImageUrls: [], propertyVideoUrls: [], textOnly: true });
    if (!delivery.providerMessageId) throw new Error("Provider returned no acceptance receipt.");
    const result = { delivery_status: "provider_accepted", providerMessageId: delivery.providerMessageId,
      message: "Follow-up submitted to the provider. Delivery is not yet confirmed." };
    // Persist acceptance before optional CRM logging, so a logging failure cannot trigger another send.
    const completed = await transition(row.id, ["sending"], { status: "completed", result, error: null });
    if (!completed) throw new Error("CRM acceptance could not be recorded.");
    await addCanonicalCrmMessage({ organizationId: row.organization_id, conversationId, senderType: "agent", direction: "outbound",
      content: action.message, externalMessageId: delivery.providerMessageId, status: "sent", metadata: { source: "leo_trigger_crm", execution_id: row.id, delivery_status: "provider_accepted" } })
      .catch(() => undefined);
    return executionResult(completed);
  } catch {
    const failed = await transition(row.id, ["processing", "sending"], { status: enteredProvider ? "unknown" : "failed",
      error: enteredProvider ? "Provider outcome is unknown. Manual reconciliation is required; this execution will not resend." : "CRM authorization, tenant binding or delivery preflight failed. No message was sent." });
    return executionResult(failed || await loadExecution(row.id));
  }
}
