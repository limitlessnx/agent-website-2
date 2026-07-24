import type { Agent, AgentFamily, Organization, Project, TenantContext } from "@/lib/platform-domain";
import { supabaseRest } from "@/lib/supabase-server-rest";

async function first<T>(path: string) {
  const rows = await supabaseRest<T[]>(`${path}&limit=1`);
  return rows[0] || null;
}

export async function getOrganizationBySlug(slug: string) {
  return first<Organization>(
    `organizations?slug=eq.${encodeURIComponent(slug)}&select=*`,
  );
}

export async function getAgentFamilyBySlug(organizationId: string, slug: string) {
  return first<AgentFamily>(
    `agent_families?organization_id=eq.${encodeURIComponent(organizationId)}&slug=eq.${encodeURIComponent(slug)}&select=*`,
  );
}

export async function getProjectBySlug(agentFamilyId: string, slug: string) {
  return first<Project>(
    `projects?agent_family_id=eq.${encodeURIComponent(agentFamilyId)}&slug=eq.${encodeURIComponent(slug)}&select=*`,
  );
}

export async function getAgentBySlug(projectId: string, slug: string) {
  return first<Agent>(
    `agents?project_id=eq.${encodeURIComponent(projectId)}&slug=eq.${encodeURIComponent(slug)}&select=*`,
  );
}

export async function resolveTenantContext(input?: {
  organizationSlug?: string;
  agentFamilySlug?: string;
  projectSlug?: string;
  agentSlug?: string;
}): Promise<TenantContext> {
  const organizationSlug = input?.organizationSlug || "fluxknight";
  const agentFamilySlug = input?.agentFamilySlug || "limitless-realty";
  const projectSlug = input?.projectSlug || "maia";
  const agentSlug = input?.agentSlug || "maia";

  const organization = await getOrganizationBySlug(organizationSlug);
  if (!organization) throw new Error(`Organization '${organizationSlug}' was not found.`);

  const agentFamily = await getAgentFamilyBySlug(organization.id, agentFamilySlug);
  if (!agentFamily) throw new Error(`Agent family '${agentFamilySlug}' was not found.`);

  const project = await getProjectBySlug(agentFamily.id, projectSlug);
  if (!project) throw new Error(`Project '${projectSlug}' was not found.`);

  const agent = await getAgentBySlug(project.id, agentSlug);

  return { organization, agentFamily, project, agent };
}

export async function resolveLimitlessRealtyContext() {
  return resolveTenantContext({
    organizationSlug: "fluxknight",
    agentFamilySlug: "limitless-realty",
    projectSlug: "maia",
    agentSlug: "maia",
  });
}
