import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { buildLeoWorkspaceKpis } from "@/lib/leo-business-kpis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity(request);
    if (identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
    const workspace = request.nextUrl.searchParams.get("workspace") || undefined;
    const organizationId = request.nextUrl.searchParams.get("organizationId") || undefined;
    const snapshot = await buildLeoWorkspaceKpis({ identity, workspace, organizationId });
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build KPI snapshot." }, { status: 500 });
  }
}
