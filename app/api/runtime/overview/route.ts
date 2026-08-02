import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = await createClient();
  const organizationId = session.organizationId;
  const [conversations, executions, handoffs, usage] = await Promise.all([
    supabase.from("agent_conversations").select("id,agent_id,channel,status,current_stage,ai_paused,last_message_at,created_at").eq("organization_id", organizationId).order("last_message_at", { ascending: false }).limit(50),
    supabase.from("runtime_executions").select("id,agent_id,conversation_id,status,latency_ms,cost_minor,error_code,created_at,completed_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    supabase.from("handoff_requests").select("id,conversation_id,agent_id,reason,priority,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(25),
    supabase.from("usage_ledger").select("usage_type,quantity,total_cost_minor,occurred_at").eq("organization_id", organizationId).order("occurred_at", { ascending: false }).limit(200),
  ]);
  const error = conversations.error || executions.error || handoffs.error || usage.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ conversations: conversations.data, executions: executions.data, handoffs: handoffs.data, usage: usage.data });
}
