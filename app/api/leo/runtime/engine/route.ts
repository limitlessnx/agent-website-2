import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { AgentRuntimeSDK } from "@/lib/ai-runtime/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const objective = String(body.objective || body.message || "").trim();
    if (!objective) return NextResponse.json({ error: "objective is required." }, { status: 400 });
    if (body.overrideModelId && identity.scope !== "super_admin") return NextResponse.json({ error: "Only Super Admin can override the runtime model." }, { status: 403 });
    const sdk = new AgentRuntimeSDK();
    const result = await sdk.reason({
      identity,
      objective,
      organizationId: typeof body.organizationId === "string" ? body.organizationId : undefined,
      agentId: typeof body.agentId === "string" ? body.agentId : undefined,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      externalConversationId: typeof body.externalConversationId === "string" ? body.externalConversationId : undefined,
      channel: body.channel || "api",
      overrideModelId: typeof body.overrideModelId === "string" ? body.overrideModelId : undefined,
      pageContext: body.pageContext,
      metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {},
    });
    return NextResponse.json({ ok: true, result }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Runtime engine failed." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
