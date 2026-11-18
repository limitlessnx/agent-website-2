import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { getClientOnboardingProfile, type ClientOnboardingProfile } from "@/lib/client-workspace-onboarding";

export type PortalAgent = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  current_version: number;
  configuration: Record<string, unknown>;
  created_at: string;
};

export type PortalWorkflow = {
  id: string;
  name: string;
  workflow_key: string;
  provider: string;
  status: string;
  trigger_type: string | null;
  environment: string | null;
  last_run_at: string | null;
};

export type PortalWorkflowRun = {
  id: string;
  workflow_key: string;
  status: string;
  duration_ms: number | null;
  created_at: string;
};

export type ClientPortalSummary = {
  unavailableSources?: Array<"onboarding" | "agents" | "workflows" | "runs">;
  onboarding: ClientOnboardingProfile | null;
  agents: PortalAgent[];
  workflows: PortalWorkflow[];
  runs: PortalWorkflowRun[];
};

async function safeLoad<T>(loader: () => Promise<T>, fallback: T, onFailure: () => void): Promise<T> {
  try {
    return await loader();
  } catch {
    onFailure();
    return fallback;
  }
}

export async function getClientPortalSummary(organizationId: string): Promise<ClientPortalSummary> {
  const unavailableSources: NonNullable<ClientPortalSummary["unavailableSources"]> = [];
  const [onboarding, agents, workflows, runs] = await Promise.all([
    safeLoad(() => getClientOnboardingProfile(organizationId), null, () => unavailableSources.push("onboarding")),
    safeLoad(
      () => supabaseServerRequest<PortalAgent[]>(
        `agents?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,name,slug,description,status,current_version,configuration,created_at&order=created_at.desc`,
      ),
      [],
      () => unavailableSources.push("agents"),
    ),
    safeLoad(
      () => supabaseServerRequest<PortalWorkflow[]>(
        `workflow_registry?organization_uuid=eq.${encodeURIComponent(organizationId)}&select=id,name,workflow_key,provider,status,trigger_type,environment,last_run_at&order=created_at.desc`,
      ),
      [],
      () => unavailableSources.push("workflows"),
    ),
    safeLoad(
      () => supabaseServerRequest<PortalWorkflowRun[]>(
        `workflow_runs?organization_uuid=eq.${encodeURIComponent(organizationId)}&select=id,workflow_key,status,duration_ms,created_at&order=created_at.desc&limit=20`,
      ),
      [],
      () => unavailableSources.push("runs"),
    ),
  ]);

  return { onboarding, agents, workflows, runs, unavailableSources: unavailableSources.sort() };
}
