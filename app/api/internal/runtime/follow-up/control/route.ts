import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const reasons: Record<string, string> = {
  "customer.replied": "customer_replied",
  "appointment.booked": "appointment_booked",
  "purchase.started": "purchase_started",
  "lead.won": "lead_won",
  "lead.lost": "lead_lost",
  "customer.opted_out": "opted_out",
  "human.handoff": "human_handoff",
  "interest.unavailable": "interest_unavailable",
};

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const eventType = text(body.event_type);
    const customerId = text(body.customer_id);
    const leadId = text(body.lead_id);
    if (!organizationId || !eventType || (!customerId && !leadId)) {
      return NextResponse.json({ error: "organization_id, event_type and customer/lead reference are required." }, { status: 400 });
    }
    const stopReason = reasons[eventType];
    if (!stopReason) return NextResponse.json({ error: "Unsupported follow-up control event." }, { status: 400 });

    const supabase = createAdminClient();
    let query = supabase.from("crm_tasks").select("id,metadata")
      .eq("organization_id", organizationId).eq("task_type", "sales_follow_up").eq("status", "scheduled");
    if (customerId) query = query.eq("customer_id", customerId);
    if (leadId) query = query.eq("lead_id", leadId);
    const scheduled = await query;
    if (scheduled.error) throw scheduled.error;

    const now = new Date().toISOString();
    for (const task of scheduled.data || []) {
      await supabase.from("crm_tasks").update({
        status: "cancelled",
        metadata: { ...record(task.metadata), stop_reason: stopReason, stopped_at: now, stop_event: eventType },
        updated_at: now,
      }).eq("id", task.id).eq("organization_id", organizationId);
    }

    if (leadId) {
      const lead = await supabase.from("crm_leads").select("details").eq("id", leadId).eq("organization_id", organizationId).maybeSingle();
      if (!lead.error && lead.data) {
        await supabase.from("crm_leads").update({
          details: { ...record(lead.data.details), follow_up_stopped: true, follow_up_stop_reason: stopReason, follow_up_stopped_at: now },
          updated_at: now,
        }).eq("id", leadId).eq("organization_id", organizationId);
      }
    }

    return NextResponse.json({ ok: true, event_type: eventType, stop_reason: stopReason, cancelled_tasks: (scheduled.data || []).length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply follow-up control event.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 500 });
  }
}
