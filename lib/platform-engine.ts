import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type OrganizationTemplate = {
  id: string;
  name: string;
  slug: string;
  industry: string;
  description: string | null;
  status: string;
  modules: string[];
  agents: string[];
  workflows: string[];
  knowledge_structure: string[];
  integration_requirements: string[];
  created_at: string;
  updated_at: string;
};

export type OrganizationIntegration = {
  id: string;
  organization_id: string;
  organization_name: string;
  provider: string;
  display_name: string;
  status: string;
  configuration: Record<string, unknown>;
  health: Record<string, unknown>;
  last_checked_at: string | null;
  last_connected_at: string | null;
  updated_at: string;
  secret_keys: string[];
  last_rotated_at: string | null;
  has_credentials: boolean;
};

export type KnowledgeCollection = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  source_count: number;
  updated_at: string;
};

export type CustomerMemory = {
  id: string;
  organization_id: string;
  customer_key: string;
  memory_type: string;
  summary: string;
  confidence: number;
  source_type: string | null;
  updated_at: string;
};

export type PlatformEngineSummary = {
  configured: boolean;
  templates: OrganizationTemplate[];
  integrations: OrganizationIntegration[];
  knowledge: KnowledgeCollection[];
  memories: CustomerMemory[];
  errors: string[];
};

async function safeRead<T>(path: string, errors: string[], label: string): Promise<T[]> {
  try {
    return await supabaseServerRequest<T[]>(path);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : `Unable to load ${label}.`;
    errors.push(`${label}: ${message}`);
    return [];
  }
}

export async function getPlatformEngineSummary(): Promise<PlatformEngineSummary> {
  const errors: string[] = [];
  const [templates, integrations, knowledge, memories] = await Promise.all([
    safeRead<OrganizationTemplate>(
      "organization_templates?select=*&order=industry.asc,name.asc&limit=100",
      errors,
      "Organization templates",
    ),
    safeRead<OrganizationIntegration>(
      "organization_integration_admin_view?select=*&order=updated_at.desc&limit=300",
      errors,
      "Integrations",
    ),
    safeRead<KnowledgeCollection>(
      "knowledge_collections?select=id,organization_id,name,slug,description,status,source_count,updated_at&order=updated_at.desc&limit=300",
      errors,
      "Knowledge collections",
    ),
    safeRead<CustomerMemory>(
      "customer_memories?select=id,organization_id,customer_key,memory_type,summary,confidence,source_type,updated_at&order=updated_at.desc&limit=100",
      errors,
      "Customer memories",
    ),
  ]);

  return {
    configured: errors.length === 0,
    templates,
    integrations,
    knowledge,
    memories,
    errors,
  };
}

export function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}