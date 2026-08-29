import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { buildLeoExecutiveBrief } from "@/lib/leo-executive-command";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  const url = new URL(request.url);
  const workspace = url.searchParams.get("workspace")?.trim() || undefined;
  const organizationId = url.searchParams.get("organization_id")?.trim() || undefined;
  try {
    const brief = await buildLeoExecutiveBrief({ identity, workspace, organizationId, refreshOptimizations: url.searchParams.get("refresh_optimizations") !== "false" });
    return NextResponse.json({ ok: true, brief }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Executive brief could not be generated." }, { status: 500 });
  }
}
