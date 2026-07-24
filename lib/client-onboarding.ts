import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type ProvisionClientOrganizationInput = {
  userId: string;
  organizationName: string;
  organizationSlug?: string;
  templateSlug?: string;
  agentFamilyName?: string;
};

export type ProvisionClientOrganizationResult = {
  organization_id: string;
  organization_slug: string;
  branch_id: string;
  membership_id: string;
  role_id: string;
  agent_family_id: string | null;
  project_id: string | null;
};

function assertUuid(value: string, field: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${field} must be a valid UUID.`);
  }
}

export function validateProvisionClientInput(input: ProvisionClientOrganizationInput) {
  assertUuid(input.userId, "userId");

  const organizationName = input.organizationName.trim();
  if (organizationName.length < 2 || organizationName.length > 120) {
    throw new Error("organizationName must be between 2 and 120 characters.");
  }

  const organizationSlug = input.organizationSlug?.trim() || undefined;
  if (organizationSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug)) {
    throw new Error("organizationSlug must use lowercase letters, numbers, and hyphens only.");
  }

  return {
    userId: input.userId,
    organizationName,
    organizationSlug,
    templateSlug: input.templateSlug?.trim() || undefined,
    agentFamilyName: input.agentFamilyName?.trim() || undefined,
  };
}

export async function provisionClientOrganization(input: ProvisionClientOrganizationInput) {
  const validated = validateProvisionClientInput(input);

  return supabaseServerRequest<ProvisionClientOrganizationResult>(
    "rpc/provision_client_organization",
    {
      method: "POST",
      body: JSON.stringify({
        p_user_id: validated.userId,
        p_organization_name: validated.organizationName,
        p_organization_slug: validated.organizationSlug || null,
        p_template_slug: validated.templateSlug || null,
        p_agent_family_name: validated.agentFamilyName || null,
      }),
    },
  );
}
