import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoEvent } from "@/lib/leo-session-store";
import { createLeoOperationalMemory, listLeoOperationalMemories, retireLeoOperationalMemory, searchLeoOperationalMemory, type LeoMemoryKind } from "@/lib/leo-operational-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
const KINDS = new Set<LeoMemoryKind>(["decision", "outcome", "lesson", "policy", "workspace_fact"]);

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Leo operational memory requires super-admin access." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "search").trim().toLowerCase();

    if (action === "list") {
      const memories = await listLeoOperationalMemories(identity, {
        limit: Number(body.limit || 80),
        workspace: String(body.workspace || "").trim() || undefined,
        organizationId: String(body.organizationId || body.organization_id || "").trim() || undefined,
        includeRetired: body.includeRetired === true || body.include_retired === true,
      });
      return NextResponse.json({ ok: true, memories });
    }

    if (action === "search") {
      const query = String(body.query || body.objective || "").trim();
      if (!query) return NextResponse.json({ error: "query is required." }, { status: 400 });
      const memories = await searchLeoOperationalMemory(identity, {
        query,
        workspace: String(body.workspace || "").trim() || undefined,
        organizationId: String(body.organizationId || body.organization_id || "").trim() || undefined,
        limit: Number(body.limit || 8),
      });
      return NextResponse.json({ ok: true, memories });
    }

    if (action === "create") {
      const kind = String(body.kind || "decision") as LeoMemoryKind;
      if (!KINDS.has(kind)) return NextResponse.json({ error: "Unsupported memory kind." }, { status: 400 });
      const source = object(body.source);
      const memory = await createLeoOperationalMemory(identity, {
        kind,
        title: String(body.title || ""),
        summary: String(body.summary || ""),
        workspace: String(body.workspace || "").trim() || undefined,
        organizationId: String(body.organizationId || body.organization_id || "").trim() || undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        confidence: Number(body.confidence ?? 0.9),
        source: {
          type: "manual",
          sourceId: String(source.sourceId || source.source_id || "").trim() || undefined,
          sessionId: String(source.sessionId || source.session_id || "").trim() || undefined,
          evidence: Array.isArray(source.evidence) ? source.evidence.map(String) : [],
        },
      });
      await auditLeoEvent({ identity, eventType: "operational_memory_created", details: { memory_id: memory.id, kind: memory.kind, workspace: memory.workspace || null, organization_id: memory.organizationId || null } });
      return NextResponse.json({ ok: true, memory }, { status: 201 });
    }

    if (action === "retire") {
      const id = String(body.id || body.memoryId || body.memory_id || "").trim();
      if (!id) return NextResponse.json({ error: "memory id is required." }, { status: 400 });
      const memory = await retireLeoOperationalMemory(identity, id);
      await auditLeoEvent({ identity, eventType: "operational_memory_retired", details: { memory_id: memory.id, kind: memory.kind } });
      return NextResponse.json({ ok: true, memory });
    }

    return NextResponse.json({ error: "Unsupported memory action. Use list, search, create or retire." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Operational memory request failed." }, { status: 500 });
  }
}
