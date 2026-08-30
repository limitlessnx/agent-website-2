import { NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoRuntimeConfiguration, getSafeLeoRuntimeConfiguration, loadLeoRuntimeConfiguration } from "@/lib/leo-runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") {
    return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  }

  try {
    const config = loadLeoRuntimeConfiguration();
    return NextResponse.json(
      { ok: true, config: getSafeLeoRuntimeConfiguration(config), readiness: auditLeoRuntimeConfiguration(config) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Runtime configuration could not be loaded." }, { status: 500 });
  }
}
