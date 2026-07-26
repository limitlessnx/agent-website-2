import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type OrganizationAiModel = {
  provider: string;
  model_key: string;
  display_name: string;
  capabilities: Record<string, unknown>;
  settings: Record<string, unknown>;
};

export async function requireSuperAdminSession() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized.");
  return session;
}

export async function resolveOrganizationAiModel(organizationId: string) {
  if (!organizationId) throw new Error("Organization ID is required.");
  const rows = await supabaseServerRequest<OrganizationAiModel[]>(
    "rpc/resolve_organization_ai_model",
    {
      method: "POST",
      body: JSON.stringify({ target_organization_id: organizationId }),
    },
  );

  const model = rows[0];
  if (!model) {
    throw new Error("No active AI model has been assigned to this organization by the super admin.");
  }
  return model;
}

export async function assertOrganizationExists(organizationId: string) {
  const rows = await supabaseServerRequest<Array<{ id: string; status: string }>>(
    `organizations?select=id,status&id=eq.${encodeURIComponent(organizationId)}&limit=1`,
  );
  const organization = rows[0];
  if (!organization) throw new Error("Organization not found.");
  if (organization.status !== "active") throw new Error("Organization is not active.");
  return organization;
}
