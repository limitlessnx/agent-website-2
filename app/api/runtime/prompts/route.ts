import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedKeys = new Set([
  "identity",
  "business_context",
  "responsibilities",
  "communication_style",
  "qualification_rules",
  "business_rules",
  "restrictions",
  "escalation_rules",
  "channel_instructions",
  "closing_behavior",
]);

type PromptBlockInput = {
  block_key?: unknown;
  title?: unknown;
  content?: unknown;
  sort_order?: unknown;
  status?: unknown;
};

export async function PUT(request: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = (await request.json()) as { agent_id?: unknown; blocks?: PromptBlockInput[] };
    const agentId = String(body.agent_id || "");
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];
    if (!agentId || !blocks.length) return NextResponse.json({ error: "Agent and prompt blocks are required." }, { status: 400 });

    const db = createAdminClient();
    const { data: agent, error: agentError } = await db.from("agents").select("id,status,current_version").eq("organization_id", session.organizationId).eq("id", agentId).single();
    if (agentError || !agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    if (!["draft", "testing"].includes(agent.status)) return NextResponse.json({ error: "Only draft or testing agents can be configured." }, { status: 409 });

    const normalized = blocks.map((block, index) => {
      const key = String(block.block_key || "").trim();
      if (!allowedKeys.has(key)) throw new Error(`Unsupported prompt block: ${key || "unknown"}.`);
      return {
        organization_id: session.organizationId,
        agent_id: agentId,
        block_key: key,
        title: String(block.title || key.replaceAll("_", " ")).trim().slice(0, 120),
        content: String(block.content || "").trim().slice(0, 20000),
        sort_order: Number.isFinite(Number(block.sort_order)) ? Number(block.sort_order) : (index + 1) * 10,
        status: block.status === "archived" ? "archived" : "active",
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await db.from("agent_prompt_blocks").upsert(normalized, { onConflict: "organization_id,agent_id,block_key" });
    if (upsertError) throw upsertError;

    const active = normalized.filter((block) => block.status === "active" && block.content);
    if (!active.length) return NextResponse.json({ error: "At least one active prompt block must contain content." }, { status: 400 });
    const assembledPrompt = active.sort((a, b) => a.sort_order - b.sort_order).map((block) => `## ${block.title}\n${block.content}`).join("\n\n");
    const nextVersion = Number(agent.current_version || 0) + 1;

    await db.from("agent_prompt_versions").update({ status: "retired" }).eq("organization_id", session.organizationId).eq("agent_id", agentId).eq("status", "published");
    const { error: versionError } = await db.from("agent_prompt_versions").insert({
      organization_id: session.organizationId,
      agent_id: agentId,
      version: nextVersion,
      assembled_prompt: assembledPrompt,
      blocks_snapshot: active,
      status: "published",
      created_by: session.userId,
    });
    if (versionError) throw versionError;

    const { error: updateError } = await db.from("agents").update({ system_prompt: assembledPrompt, current_version: nextVersion, status: "testing", updated_at: new Date().toISOString() }).eq("organization_id", session.organizationId).eq("id", agentId);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, version: nextVersion, blocks: normalized });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save prompt blocks." }, { status: 400 });
  }
}
