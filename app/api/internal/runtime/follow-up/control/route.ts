import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertExactFollowupTarget, isAllowedFollowupControl, isNonTerminalFollowupEvent, text } from "@/lib/limitless-followup-contract";

const LIMITLESS_REALTY_ORGANIZATION_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    if (organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID) {
      return NextResponse.json({ error: "The canonical Limitless follow-up pipeline is the only supported target for this route." }, { status: 410 });
    }

    const eventType = text(body.event_type);
    if (isNonTerminalFollowupEvent(eventType)) {
      return NextResponse.json({ ok: true, event_type: eventType, cancelled_tasks: 0, sequence_changed: false, reason: "non_terminal_followup_event" });
    }

    const admin = createAdminClient();
    const leadId = text(body.lead_id) || null;
    if (eventType === "customer.opted_out") {
      if (!leadId) return NextResponse.json({ error: "A tenant-scoped lead identity is required to record customer opt-out." }, { status: 400 });
      const { data, error } = await admin.rpc("record_limitless_maia_opt_out", {
        p_organization_id: organizationId,
        p_lead_id: leadId,
        p_external_event_id: text(body.external_event_id) || null,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, event_type: eventType, result: data });
    }

    const customerId = text(body.customer_id);
    const propertyId = Object.prototype.hasOwnProperty.call(body, "property_id") ? (text(body.property_id) || null) : undefined;
    const sequenceId = text(body.sequence_id);
    const stepId = text(body.step_id) || null;
    const actor = text(body.actor_id) || text(body.actor) || "system:followup-control";
    const reason = text(body.reason) || eventType || "exact follow-up control";
    const action = text(body.action) || (eventType === "admin.close" ? "close" : "stop");
    if (!customerId || propertyId === undefined || !sequenceId || !isAllowedFollowupControl(action)) {
      return NextResponse.json({ error: "Exact tenant, customer, property scope, sequence identity, action, reason, and audited actor are required." }, { status: 400 });
    }
    if (["cancel", "complete", "reschedule", "retry"].includes(action) && !stepId) {
      return NextResponse.json({ error: `${action} requires an exact step_id.` }, { status: 400 });
    }

    const target = { organization_id: organizationId, customer_id: customerId, lead_id: leadId, property_id: propertyId, sequence_id: sequenceId, step_id: stepId, reason, actor };
    assertExactFollowupTarget(target);
    const { data, error } = await admin.rpc("control_limitless_maia_followup_sequence", {
      p_organization_id: organizationId,
      p_customer_id: customerId,
      p_property_id: propertyId,
      p_sequence_id: sequenceId,
      p_step_id: stepId,
      p_action: action,
      p_reason: reason,
      p_actor: actor,
      p_scheduled_at: text(body.scheduled_at) || null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, event_type: eventType || `control.${action}`, action, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply exact follow-up control event.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 500 });
  }
}
