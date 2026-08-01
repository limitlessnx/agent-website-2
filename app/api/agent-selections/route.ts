import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

const catalog = {
  ai_sales_agent: { name: "AI Sales Agent", setup: 250000, monthly: 100000 },
  customer_support_agent: { name: "Customer Support Agent", setup: 220000, monthly: 90000 },
  whatsapp_agent: { name: "WhatsApp Agent", setup: 180000, monthly: 75000 },
  appointment_agent: { name: "Appointment Agent", setup: 150000, monthly: 60000 },
  email_automation: { name: "Email Follow-up Agent", setup: 180000, monthly: 70000 },
  voice_receptionist: { name: "Voice Receptionist", setup: 350000, monthly: 150000 },
  outbound_call_agent: { name: "Outbound Call Agent", setup: 400000, monthly: 180000 },
  crm_followup_agent: { name: "CRM Follow-up Agent", setup: 200000, monthly: 80000 },
} as const;

type AgentKey = keyof typeof catalog;

async function sessionOrThrow() {
  const session = await getClientSession();
  if (!session) throw new Error("Authentication required.");
  return session;
}

export async function GET() {
  try {
    const session = await sessionOrThrow();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_agent_selections")
      .select("id,agent_key,display_name,status,setup_price,monthly_price,currency,configuration")
      .eq("organization_id", session.organizationId)
      .order("created_at");
    if (error) throw error;
    return NextResponse.json({ selections: data || [], catalog });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await sessionOrThrow();
    const body = await request.json();
    const selected = Array.isArray(body.agent_keys)
      ? [...new Set(body.agent_keys.map(String))].filter((key): key is AgentKey => key in catalog)
      : [];
    if (!selected.length) return NextResponse.json({ error: "Select at least one standard agent." }, { status: 400 });

    const supabase = await createClient();
    const rows = selected.map((agentKey) => ({
      organization_id: session.organizationId,
      agent_key: agentKey,
      display_name: catalog[agentKey].name,
      setup_price: catalog[agentKey].setup,
      monthly_price: catalog[agentKey].monthly,
      currency: "NGN",
      status: "selected",
      configuration: {},
    }));

    const { error: upsertError } = await supabase
      .from("organization_agent_selections")
      .upsert(rows, { onConflict: "organization_id,agent_key" });
    if (upsertError) throw upsertError;

    const { error: removeError } = await supabase
      .from("organization_agent_selections")
      .delete()
      .eq("organization_id", session.organizationId)
      .in("status", ["selected", "configured"])
      .not("agent_key", "in", `(${selected.join(",")})`);
    if (removeError) throw removeError;

    const setupTotal = selected.reduce((sum, key) => sum + catalog[key].setup, 0);
    const monthlyTotal = selected.reduce((sum, key) => sum + catalog[key].monthly, 0);

    return NextResponse.json({ ok: true, setup_total: setupTotal, monthly_total: monthlyTotal, currency: "NGN" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}
