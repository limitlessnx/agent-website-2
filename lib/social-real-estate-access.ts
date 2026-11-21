import { getAdminSession } from "@/lib/admin-auth";
import { requireTenant } from "@/lib/tenant";
import { REALTY_SOCIAL_ORGANIZATION } from "@/lib/social-real-estate-policy";

export async function requireRealtySocialAdmin() {
  if (!await getAdminSession()) throw new Error("Administrator sign-in is required.");
  const tenant = await requireTenant();
  if (tenant.organizationId !== REALTY_SOCIAL_ORGANIZATION || tenant.organization.status !== "active") throw new Error("Select the active Limitless Realty workspace first.");
  return tenant;
}

// Existing provider administration belongs to Fluxknight. Opening a new
// organization's social UI must not expose or overwrite that connection.
export async function requireFluxSocialProviderWorkspace() {
  if (!await getAdminSession()) throw new Error("Administrator sign-in is required.");
  const tenant = await requireTenant();
  if (tenant.organizationId !== "15046426-e520-438b-8694-7662a6986efb") throw new Error("Provider administration here belongs to the Fluxknight workspace.");
  return tenant;
}
