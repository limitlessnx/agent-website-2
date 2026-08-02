import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const sourceTypes = new Set(["website", "faq", "product", "policy", "manual_note", "pdf"]);

export async function POST(request: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = (await request.json()) as Record<string, unknown>;
    const agentId = String(body.agent_id || "");
    const title = String(body.title || "").trim().slice(0, 160);
    const sourceType = String(body.source_type || "manual_note");
    const sourceUrl = String(body.source_url || "").trim().slice(0, 2000) || null;
    const content = String(body.content || "").trim().slice(0, 100000) || null;
    if (!agentId || !title || !sourceTypes.has(sourceType)) return NextResponse.json({ error: "Agent, title and a supported knowledge type are required." }, { status: 400 });
    if (!sourceUrl && !content) return NextResponse.json({ error: "Provide a source URL or knowledge content." }, { status: 400 });

    const db = createAdminClient();
    const { data: agent, error: agentError } = await db.from("agents").select("id,name").eq("organization_id", session.organizationId).eq("id", agentId).single();
    if (agentError || !agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

    let collectionId = String(body.collection_id || "");
    if (collectionId) {
      const { data: collection } = await db.from("knowledge_collections").select("id").eq("organization_id", session.organizationId).eq("id", collectionId).maybeSingle();
      if (!collection) return NextResponse.json({ error: "Knowledge collection not found." }, { status: 404 });
    } else {
      const slug = `${agentId.slice(0, 8)}-runtime`;
      const existing = await db.from("knowledge_collections").select("id").eq("organization_id", session.organizationId).eq("slug", slug).maybeSingle();
      if (existing.data?.id) collectionId = existing.data.id;
      else {
        const created = await db.from("knowledge_collections").insert({ organization_id: session.organizationId, name: `${agent.name} Knowledge`, slug, description: "Tenant-managed knowledge for this agent.", status: "active", source_count: 0, metadata: { agent_id: agentId } }).select("id").single();
        if (created.error) throw created.error;
        collectionId = created.data.id;
      }
    }

    const checksum = createHash("sha256").update(`${sourceType}:${sourceUrl || ""}:${content || ""}`).digest("hex");
    const inserted = await db.from("knowledge_sources").insert({
      organization_id: session.organizationId,
      collection_id: collectionId,
      title,
      source_type: sourceType,
      source_url: sourceUrl,
      content,
      status: content ? "ready" : "pending",
      checksum,
      metadata: { created_by: session.userId },
    }).select("id,collection_id,title,source_type,source_url,status,updated_at").single();
    if (inserted.error) throw inserted.error;

    const binding = await db.from("agent_knowledge_bindings").upsert({ organization_id: session.organizationId, agent_id: agentId, collection_id: collectionId, required: true, status: "active", updated_at: new Date().toISOString() }, { onConflict: "organization_id,agent_id,collection_id" });
    if (binding.error) throw binding.error;

    const countResult = await db.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("organization_id", session.organizationId).eq("collection_id", collectionId);
    await db.from("knowledge_collections").update({ source_count: countResult.count || 0, updated_at: new Date().toISOString() }).eq("organization_id", session.organizationId).eq("id", collectionId);

    return NextResponse.json({ ok: true, source: inserted.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save knowledge source." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const sourceId = new URL(request.url).searchParams.get("source_id") || "";
    if (!sourceId) return NextResponse.json({ error: "Knowledge source is required." }, { status: 400 });
    const db = createAdminClient();
    const { error } = await db.from("knowledge_sources").delete().eq("organization_id", session.organizationId).eq("id", sourceId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove knowledge source." }, { status: 400 });
  }
}
