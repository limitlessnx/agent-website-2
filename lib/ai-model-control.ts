import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type AiModelCatalogItem = {
  id: string;
  provider: string;
  model_key: string;
  display_name: string;
  status: "active" | "disabled";
  capabilities: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OrganizationModelAssignment = {
  organization_id: string;
  model_id: string;
  assigned_at: string;
  updated_at: string;
};

export type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export async function getAiModelControlData() {
  const [models, assignments, organizations] = await Promise.all([
    supabaseServerRequest<AiModelCatalogItem[]>(
      "ai_model_catalog?select=*&order=status.asc,provider.asc,display_name.asc",
    ),
    supabaseServerRequest<OrganizationModelAssignment[]>(
      "organization_ai_model_assignments?select=organization_id,model_id,assigned_at,updated_at&order=updated_at.desc",
    ),
    supabaseServerRequest<OrganizationOption[]>(
      "organizations?select=id,name,slug,status&order=name.asc",
    ),
  ]);

  return { models, assignments, organizations };
}
