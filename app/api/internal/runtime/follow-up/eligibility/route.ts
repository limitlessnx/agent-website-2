import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateFollowUpEligibility, resolveFollowUpPolicy } from "@/lib/follow-up-policy";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const organizationKey = text(body.organization_key) || text(record(body.input).organization_key) || null;
    const agentId = text(body.agent_id);
    const customerId = text(body.customer_id);
    const leadId = text(body.lead_id);
    const conversationId = text(body.conversation_id);
    const input = record(body.input);

    if (!organizationId || !agentId) {
      return NextResponse.json({ error: "organization_id and agent_id are required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const agent = await supabase
      .from("agents")
      .select("id,organization_id,status")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (agent.error) throw agent.error;
    if (!agent.data) return NextResponse.json({ error: "Agent does not belong to this organization." }, { status: 409 });

    const [customerResult, leadResult, conversationResult] = await Promise.all([
      customerId
        ? supabase.from("crm_customers").select("id,status,profile,metadata,email,phone").eq("id", customerId).eq("organization_id", organizationId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      leadId
        ? supabase.from("crm_leads").select("id,stage,score,details,summary,updated_at").eq("id", leadId).eq("organization_id", organizationId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      conversationId
        ? supabase.from("agent_conversations").select("id,status,ai_paused,current_stage,last_message_at,metadata").eq("id", conversationId).eq("organization_id", organizationId).eq("agent_id", agentId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (customerResult.error) throw customerResult.error;
    if (leadResult.error) throw leadResult.error;
    if (conversationResult.error) throw conversationResult.error;

    const policy = await resolveFollowUpPolicy(organizationId, organizationKey);
    const eligibility = evaluateFollowUpEligibility({
      policy,
      input,
      customer: customerResult.data as Record<string, unknown> | null,
      lead: leadResult.data as Record<string, unknown> | null,
      conversation: conversationResult.data as Record<string, unknown> | null,
    });

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      organization_key: organizationKey,
      agent_id: agentId,
      policy,
      eligibility,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to evaluate follow-up eligibility." },
      { status: 500 },
    );
  }
}
