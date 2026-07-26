import { isServerSupabaseConfigured, supabaseRest } from "@/lib/supabase-server-rest";
import { resolveOrganizationAiModel } from "@/lib/organization-security";
import type { WorkflowRecord } from "@/lib/workflow-registry";

export type AgentStatus = "draft" | "active" | "paused" | "disabled" | "error";

export type ManagedAgent = {
  id: string;
  organization_id: string;
  agent_family_id?: string | null;
  project_id: string;
  branch_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  agent_type?: string | null;
  status: AgentStatus | string;
  system_prompt?: string | null;
  ai_model?: string | null;
  temperature?: number | null;
  language?: string | null;
  voice_provider?: string | null;
  communication_channels?: unknown[] | null;
  escalation_rules?: unknown[] | null;
  human_handoff_destination?: Record<string, unknown> | null;
  knowledge_sources?: unknown[] | null;
  configuration?: Record<string, unknown> | null;
  current_version?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type AgentProject = {
  id: string;
  organization_id: string;
  agent_family_id?: string | null;
  name: string;
  slug: string;
  status?: string;
};

export type AgentWorkflowLink = {
  id: string;
  agent_id: string;
  workflow_id: string;
  role: string;
};

export type AgentManagementSummary = {
  configured: boolean;
  agents: ManagedAgent[];
  projects: AgentProject[];
  workflows: WorkflowRecord[];
  links: AgentWorkflowLink[];
};

const statuses = new Set(["draft", "active", "paused", "disabled", "error"]);

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeAgent(agent: ManagedAgent): ManagedAgent {
  const config = agent.configuration || {};
  return {
    ...agent,
    agent_type: agent.agent_type || String(config.agent_key || "custom_agent"),
    temperature: Number(agent.temperature ?? config.temperature ?? 0.3),
    language: agent.language || String(config.language || "English"),
    voice_provider: agent.voice_provider || (config.voice_provider ? String(config.voice_provider) : null),
    communication_channels: asArray(agent.communication_channels).length ? asArray(agent.communication_channels) : asArray(config.channels),
    escalation_rules: asArray(agent.escalation_rules).length ? asArray(agent.escalation_rules) : asArray(config.escalation_rules),
    human_handoff_destination:
      agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length
        ? agent.human_handoff_destination
        : ((config.human_contact as Record<string, unknown>) || {}),
    knowledge_sources: asArray(agent.knowledge_sources).length ? asArray(agent.knowledge_sources) : asArray(config.knowledge_sources),
  };
}

export async function getAgentManagementSummary(): Promise<AgentManagementSummary> {
  if (!isServerSupabaseConfigured()) return { configured: false, agents: [], projects: [], workflows: [], links: [] };

  const [agents, projects, workflows, links] = await Promise.all([
    supabaseRest<ManagedAgent[]>("agents?select=*&order=updated_at.desc.nullslast&limit=300"),
    supabaseRest<AgentProject[]>("projects?select=id,organization_id,agent_family_id,name,slug,status&order=name.asc&limit=200"),
    supabaseRest<WorkflowRecord[]>("workflow_registry?select=*&order=name.asc&limit=500"),
    supabaseRest<AgentWorkflowLink[]>("agent_workflow_links?select=id,agent_id,workflow_id,role&limit=1000").catch(() => []),
  ]);

  return { configured: true, agents: agents.map(normalizeAgent), projects, workflows, links };
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function parseList(value: unknown) {
  return clean(value).split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

export async function saveManagedAgent(input: Record<string, unknown>) {
  const id = clean(input.id);
  const projectId = clean(input.project_id);
  const name = clean(input.name);
  const slug = clean(input.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  const status = clean(input.status || "draft");
  const temperature = Number(input.temperature ?? 0.3);

  if (!projectId || !name || !slug) throw new Error("Project, agent name, and slug are required.");
  if (!statuses.has(status)) throw new Error("Invalid agent status.");
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error("Temperature must be between 0 and 2.");

  const projects = await supabaseRest<AgentProject[]>(
    `projects?id=eq.${encodeURIComponent(projectId)}&select=id,organization_id,agent_family_id&limit=1`,
  );
  const project = projects[0];
  if (!project) throw new Error("Selected project was not found.");

  if (status === "active") await resolveOrganizationAiModel(project.organization_id);

  const channels = parseList(input.communication_channels);
  const escalationRules = parseList(input.escalation_rules);
  const knowledgeSources = parseList(input.knowledge_sources).map((value) => ({ type: "reference", label: value, value }));
  const handoff = {
    type: clean(input.handoff_type || "team"),
    label: clean(input.handoff_label),
    email: clean(input.handoff_email),
    phone: clean(input.handoff_phone),
  };
  const tone = clean(input.tone || "Professional and helpful");

  const payload = {
    organization_id: project.organization_id,
    agent_family_id: project.agent_family_id || null,
    project_id: project.id,
    name,
    slug,
    description: clean(input.description) || null,
    agent_type: clean(input.agent_type || "custom_agent"),
    status,
    system_prompt: clean(input.system_prompt),
    temperature,
    language: clean(input.language || "English"),
    voice_provider: clean(input.voice_provider) || null,
    communication_channels: channels,
    escalation_rules: escalationRules,
    human_handoff_destination: handoff,
    knowledge_sources: knowledgeSources,
    configuration: {
      agent_key: clean(input.agent_type || "custom_agent"),
      temperature,
      language: clean(input.language || "English"),
      tone,
      voice_provider: clean(input.voice_provider) || null,
      channels,
      escalation_rules: escalationRules,
      human_contact: handoff,
      knowledge_sources: knowledgeSources,
      model_governance: "organization_assignment",
    },
  };

  const rows = id
    ? await supabaseRest<ManagedAgent[]>(`agents?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) })
    : await supabaseRest<ManagedAgent[]>("agents", { method: "POST", body: JSON.stringify(payload) });

  return rows[0] || null;
}

export async function replaceAgentWorkflowLinks(agentId: string, workflowIds: string[]) {
  if (!agentId) throw new Error("Agent ID is required.");
  await supabaseRest<unknown[]>(`agent_workflow_links?agent_id=eq.${encodeURIComponent(agentId)}`, { method: "DELETE" });

  const unique = [...new Set(workflowIds.filter(Boolean))];
  if (!unique.length) return [];

  const agents = await supabaseRest<ManagedAgent[]>(`agents?id=eq.${encodeURIComponent(agentId)}&select=organization_id&limit=1`);
  const organizationId = agents[0]?.organization_id;

  return supabaseRest<AgentWorkflowLink[]>("agent_workflow_links", {
    method: "POST",
    body: JSON.stringify(unique.map((workflowId) => ({ organization_id: organizationId || null, agent_id: agentId, workflow_id: workflowId, role: "connected" }))),
  });
}
