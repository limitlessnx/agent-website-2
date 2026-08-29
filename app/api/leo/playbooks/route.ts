import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoEvent } from "@/lib/leo-session-store";
import { compactLeoPlaybooksForContext, createLeoPlaybookVersion, listLeoOperationalPlaybooks, matchLeoOperationalPlaybooks, publishLeoPlaybook, retireLeoPlaybook } from "@/lib/leo-operational-playbooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function GET(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Operational playbooks require super-admin access." }, { status: 403 });
  const params = request.nextUrl.searchParams;
  const query = String(params.get("query") || "").trim();
  const workspace = String(params.get("workspace") || "").trim() || undefined;
  if (query) {
    const playbooks = await matchLeoOperationalPlaybooks(identity, { query, workspace, limit: Number(params.get("limit") || 4) });
    return NextResponse.json({ ok: true, playbooks, context: compactLeoPlaybooksForContext(playbooks) });
  }
  const playbooks = await listLeoOperationalPlaybooks(identity, { includeDrafts: params.get("drafts") === "1", includeRetired: params.get("retired") === "1" });
  return NextResponse.json({ ok: true, playbooks });
}

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Operational playbooks require super-admin access." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "create_version").trim().toLowerCase();
    if (action === "match") {
      const playbooks = await matchLeoOperationalPlaybooks(identity, { query: String(body.query || body.objective || ""), workspace: String(body.workspace || "").trim() || undefined, limit: Number(body.limit || 4) });
      return NextResponse.json({ ok: true, playbooks, context: compactLeoPlaybooksForContext(playbooks) });
    }
    if (action === "create_version") {
      const playbook = await createLeoPlaybookVersion(identity, object(body.playbook || body));
      await auditLeoEvent({ identity, eventType: "operational_playbook_version_created", details: { key: playbook.key, version: playbook.version, status: playbook.status } });
      return NextResponse.json({ ok: true, playbook }, { status: 201 });
    }
    const key = String(body.key || "").trim();
    const version = Number(body.version || 0);
    if (!key || !version) return NextResponse.json({ error: "key and version are required." }, { status: 400 });
    if (action === "publish") {
      const playbook = await publishLeoPlaybook(identity, key, version);
      await auditLeoEvent({ identity, eventType: "operational_playbook_published", details: { key, version } });
      return NextResponse.json({ ok: true, playbook });
    }
    if (action === "retire") {
      const playbook = await retireLeoPlaybook(identity, key, version);
      await auditLeoEvent({ identity, eventType: "operational_playbook_retired", details: { key, version } });
      return NextResponse.json({ ok: true, playbook });
    }
    return NextResponse.json({ error: "Unsupported action. Use match, create_version, publish or retire." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Operational playbook operation failed." }, { status: 500 });
  }
}
