import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { replaceAgentWorkflowLinks, saveManagedAgent } from "@/lib/agent-management";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const agent = await saveManagedAgent(body);
    if (!agent) throw new Error("Agent could not be saved.");
    const workflowIds = Array.isArray(body.workflow_ids) ? body.workflow_ids.map(String) : [];
    await replaceAgentWorkflowLinks(agent.id, workflowIds);
    return NextResponse.json({ ok: true, agent });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent save failed." },
      { status: 500 },
    );
  }
}