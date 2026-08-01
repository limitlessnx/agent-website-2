import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";
import { isN8nApiConfigured, listN8nExecutions, listN8nWorkflows } from "@/lib/n8n-api";

type Conversation = { id: string; title: string; status: string; priority: string; updated_at: string };
type Message = { id: string; conversation_id: string; role: string; content: string; diagnostics?: Record<string, unknown>; created_at: string };

async function requireAdmin() {
  return (await getAdminSession()) || null;
}

async function collectDiagnostics(organizationId?: string) {
  const [registry, organizations] = await Promise.all([
    getWorkflowRegistrySummary().catch(() => ({ workflows: [], runs: [], active: 0, failures: 0, successRate: 0 })),
    supabaseServerRequest<Array<{ id: string; name: string; slug: string; status: string }>>(
      `organizations?select=id,name,slug,status${organizationId ? `&id=eq.${encodeURIComponent(organizationId)}` : ""}&order=created_at.desc&limit=20`,
    ).catch(() => []),
  ]);

  let n8n: Record<string, unknown> = { configured: isN8nApiConfigured() };
  if (isN8nApiConfigured()) {
    const [workflows, executions] = await Promise.all([
      listN8nWorkflows(100).catch(() => []),
      listN8nExecutions({ limit: 50, includeData: true }).catch(() => []),
    ]);
    n8n = {
      configured: true,
      workflows: workflows.length,
      activeWorkflows: workflows.filter((workflow) => workflow.active).length,
      recentExecutions: executions.length,
      recentErrors: executions.filter((execution) => execution.status === "error").length,
    };
  }

  return {
    collectedAt: new Date().toISOString(),
    organizations,
    workflowRegistry: {
      total: registry.workflows.length,
      active: registry.active,
      failures: registry.failures,
      successRate: registry.successRate,
    },
    n8n,
  };
}

function buildLeoReply(message: string, diagnostics: Awaited<ReturnType<typeof collectDiagnostics>>) {
  const text = message.toLowerCase();
  const registry = diagnostics.workflowRegistry;
  const n8n = diagnostics.n8n as { configured?: boolean; recentErrors?: number; activeWorkflows?: number; workflows?: number };
  const findings: string[] = [];
  const actions: Array<{ action_key: string; title: string; description: string; risk_level: string }> = [];

  if (!n8n.configured) findings.push("The n8n API connection is not available to Agent Leo in this deployment.");
  if ((n8n.recentErrors || 0) > 0) findings.push(`${n8n.recentErrors} recent n8n execution error(s) were detected.`);
  if (registry.failures > 0) findings.push(`${registry.failures} failed or timed-out workflow run(s) exist in the Fluxknight registry.`);
  if (registry.total > 0 && registry.active === 0) findings.push("Workflows exist in the registry, but none are currently active.");

  if (text.includes("whatsapp") || text.includes("maia") || text.includes("message")) {
    findings.push("For messaging incidents, the next checks are workflow activation, the latest execution error, channel credentials, and recipient formatting.");
    actions.push({ action_key: "inspect_messaging_failures", title: "Inspect messaging failures", description: "Review recent messaging workflow executions and return the failing node and error message.", risk_level: "low" });
  }
  if (text.includes("workflow") || text.includes("n8n") || text.includes("automation")) {
    actions.push({ action_key: "resync_workflow_registry", title: "Resync workflow registry", description: "Compare n8n workflows with Fluxknight mappings and repair missing registry links. No workflow will be activated automatically.", risk_level: "medium" });
  }
  if (text.includes("organization") || text.includes("project")) {
    actions.push({ action_key: "verify_organization_provisioning", title: "Verify organization provisioning", description: "Check the organization, internal project, n8n project mapping, and generated workflow records.", risk_level: "low" });
  }

  if (!findings.length) findings.push("No obvious platform-wide fault appeared in the first diagnostic pass.");

  return {
    content: [
      "I completed an initial diagnostic pass.",
      "",
      "Findings:",
      ...findings.map((finding) => `• ${finding}`),
      "",
      `Platform snapshot: ${registry.active}/${registry.total} registered workflows active, ${registry.successRate}% recorded success rate, ${n8n.activeWorkflows ?? 0}/${n8n.workflows ?? 0} n8n workflows active.`,
      "",
      actions.length ? "I prepared approval-gated actions below. I will not modify production systems without approval." : "Describe the affected organization, agent, channel, and the latest error so I can narrow the diagnosis.",
    ].join("\n"),
    actions,
  };
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  const conversations = await supabaseServerRequest<Conversation[]>(
    "support_conversations?select=id,title,status,priority,updated_at&order=updated_at.desc&limit=50",
  ).catch(() => []);
  const messages = conversationId
    ? await supabaseServerRequest<Message[]>(`support_messages?select=*&conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc`).catch(() => [])
    : [];

  return NextResponse.json({ ok: true, conversations, messages });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    const organizationId = String(body.organizationId || "").trim() || undefined;
    let conversationId = String(body.conversationId || "").trim();
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    if (!conversationId) {
      const rows = await supabaseServerRequest<Conversation[]>("support_conversations", {
        method: "POST",
        body: JSON.stringify({
          organization_id: organizationId || null,
          title: message.slice(0, 80),
          status: "diagnosing",
          created_by: session.email,
          assigned_agent: "agent-leo",
        }),
      });
      conversationId = rows[0]?.id || "";
    }
    if (!conversationId) throw new Error("Unable to create support conversation.");

    await supabaseServerRequest("support_messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversationId, role: "user", content: message }),
    });

    const diagnostics = await collectDiagnostics(organizationId);
    const reply = buildLeoReply(message, diagnostics);

    await supabaseServerRequest("support_messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversationId, role: "assistant", content: reply.content, diagnostics }),
    });

    for (const action of reply.actions) {
      await supabaseServerRequest("support_actions", {
        method: "POST",
        body: JSON.stringify({ conversation_id: conversationId, organization_id: organizationId || null, ...action }),
      });
    }

    await supabaseServerRequest(`support_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: reply.actions.length ? "waiting_approval" : "open", updated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ ok: true, conversationId, reply: reply.content, diagnostics, actions: reply.actions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Agent Leo could not complete the diagnostic." }, { status: 500 });
  }
}
