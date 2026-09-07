import { NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { answerLeoLifecycleQuestion, buildLeoLifecycleOperations } from "@/lib/leo-lifecycle-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") {
    return NextResponse.json({ error: "Super Leo lifecycle intelligence is restricted to Fluxknight administration." }, { status: 403 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organization_id")?.trim() || undefined;
  const question = url.searchParams.get("question")?.trim() || "Which clients need attention?";

  try {
    const snapshot = await buildLeoLifecycleOperations({ identity, organizationId });
    const response = answerLeoLifecycleQuestion(snapshot, question);
    return NextResponse.json({ ok: true, response, snapshot }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("leo_lifecycle_intelligence_failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lifecycle operational intelligence could not be generated." }, { status: 500 });
  }
}
