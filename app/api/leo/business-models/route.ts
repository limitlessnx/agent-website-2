import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { buildLeoWorkspaceBusinessModelSnapshot, createLeoWorkspaceBusinessModelDraft, listLeoWorkspaceBusinessModels, setLeoWorkspaceBusinessModelStatus } from "@/lib/leo-workspace-business-models";

export const dynamic = "force-dynamic";

async function identity() { return resolveLeoIdentity({ channel: "api", allowPublic: false }); }

export async function GET(request: NextRequest) {
  try {
    const actor = await identity();
    if (!actor || actor.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
    const workspace = request.nextUrl.searchParams.get("workspace") || undefined;
    const organizationId = request.nextUrl.searchParams.get("organizationId") || undefined;
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    if (workspace || organizationId) return NextResponse.json(await buildLeoWorkspaceBusinessModelSnapshot({ identity: actor, workspace, organizationId }), { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: true, models: await listLeoWorkspaceBusinessModels(actor, includeInactive) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load workspace business models." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await identity();
    if (!actor || actor.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "resolve").toLowerCase();
    if (action === "resolve") return NextResponse.json(await buildLeoWorkspaceBusinessModelSnapshot({ identity: actor, workspace: body.workspace || undefined, organizationId: body.organizationId || body.organization_id || undefined }));
    if (action === "create_draft") return NextResponse.json({ ok: true, model: await createLeoWorkspaceBusinessModelDraft(actor, body.model || body) }, { status: 201 });
    if (["publish", "retire", "draft"].includes(action)) {
      const id = String(body.modelId || body.model_id || "").trim();
      if (!id) return NextResponse.json({ error: "modelId is required." }, { status: 400 });
      const status = action === "publish" ? "active" : action === "retire" ? "retired" : "draft";
      return NextResponse.json({ ok: true, model: await setLeoWorkspaceBusinessModelStatus(actor, id, status) });
    }
    return NextResponse.json({ error: "Unsupported action. Use resolve, create_draft, publish, retire or draft." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace business model operation failed." }, { status: 500 });
  }
}
