import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.EVENT_GATEWAY_SECRET || process.env.CRON_SECRET || "";
    const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!expected || !secureEqual(supplied, expected)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = (await request.json()) as Record<string, unknown>;
    const organizationId = String(body.organization_id || "");
    const agentId = body.agent_id ? String(body.agent_id) : null;
    const eventType = String(body.event_type || "").trim();
    const source = String(body.source || "platform").trim();
    const requestId = body.request_id ? String(body.request_id) : crypto.randomUUID();
    const payload = typeof body.payload === "object" && body.payload ? body.payload : {};
    if (!organizationId || !eventType) return NextResponse.json({ error: "organization_id and event_type are required." }, { status: 400 });

    const db = createAdminClient();
    if (agentId) {
      const { data: agent } = await db.from("agents").select("id").eq("organization_id", organizationId).eq("id", agentId).maybeSingle();
      if (!agent) return NextResponse.json({ error: "Agent does not belong to organization." }, { status: 409 });
    }

    const { data, error } = await db.from("domain_events").upsert({ request_id: requestId, organization_id: organizationId, agent_id: agentId, event_type: eventType, source, payload, status: "pending", available_at: new Date().toISOString() }, { onConflict: "request_id", ignoreDuplicates: true }).select("id,request_id,status,created_at").maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, event: data || { request_id: requestId, status: "duplicate" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to accept event." }, { status: 400 });
  }
}
