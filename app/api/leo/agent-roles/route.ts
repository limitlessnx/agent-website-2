import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoAgentRoles, getLeoAgentRole, listLeoAgentRoles } from "@/lib/leo-agent-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  try {
    const key = request.nextUrl.searchParams.get("key")?.trim();
    if (key) {
      const role = getLeoAgentRole(identity, key);
      if (!role) return NextResponse.json({ error: "Agent role not found." }, { status: 404 });
      return NextResponse.json({ ok: true, role }, { headers: { "cache-control": "no-store" } });
    }
    return NextResponse.json({ ok: true, roles: listLeoAgentRoles(identity), audit: auditLeoAgentRoles(identity) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Agent roles could not be loaded." }, { status: 500 });
  }
}
