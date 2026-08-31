import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { consumeRuntimeAgentMessages, publishRuntimeAgentMessage } from "@/lib/ai-runtime/agent-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "publish").trim();
    const organizationId = identity.scope === "tenant" ? identity.organizationId : String(body.organizationId || "").trim();
    if (!organizationId) return NextResponse.json({ error: "organizationId is required." }, { status: 400 });

    if (action === "consume") {
      const agentId = String(body.agentId || "").trim();
      if (!agentId) return NextResponse.json({ error: "agentId is required." }, { status: 400 });
      const messages = await consumeRuntimeAgentMessages({ identity, organizationId, agentId, limit: Number(body.limit || 20) });
      return NextResponse.json({ ok: true, messages }, { headers: { "cache-control": "no-store" } });
    }

    const sourceAgentId = String(body.sourceAgentId || "").trim();
    const targetAgentId = String(body.targetAgentId || "").trim();
    const event = String(body.event || "").trim();
    const correlationId = String(body.correlationId || crypto.randomUUID()).trim();
    if (!sourceAgentId || !targetAgentId || !event) return NextResponse.json({ error: "sourceAgentId, targetAgentId and event are required." }, { status: 400 });
    const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload as Record<string, unknown> : {};
    const message = await publishRuntimeAgentMessage(identity, { organizationId, sourceAgentId, targetAgentId, event, payload, correlationId });
    return NextResponse.json({ ok: true, message }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Agent bus request failed." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
