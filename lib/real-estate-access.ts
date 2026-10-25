import { getAdminSession } from "@/lib/admin-auth";
import { getClientSession } from "@/lib/client-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRealEstateOrganizationRecord } from "@/lib/real-estate-organization";

export type RealEstatePermission = "catalog.read" | "catalog.write" | "knowledge.write" | "appointments.read" | "appointments.write";
const permissions: Record<RealEstatePermission, string[]> = {
  "catalog.read": ["customers.view", "customers.manage"],
  "catalog.write": ["customers.manage"],
  "knowledge.write": ["knowledge.manage"],
  "appointments.read": ["appointments.view", "appointments.manage"],
  "appointments.write": ["appointments.manage"],
};

export function isRealEstateOrganization(organization: {slug?:string;status?:string;metadata?:unknown}) {
  return isRealEstateOrganizationRecord(organization);
}

export async function requireRealEstateAccess(permission: RealEstatePermission = "catalog.read") {
  const adminSession = await getAdminSession();
  const clientSession = adminSession ? null : await getClientSession();
  if (!adminSession && !clientSession) throw new Error("Authentication required.");
  const organizationId = adminSession ? (await resolveAdminOrganizationScope()).organizationId : clientSession!.organizationId;
  if (!organizationId || organizationId.startsWith("unavailable:")) throw new Error("Select an available real-estate organization first.");
  if (clientSession) {
    const access = await getOrganizationAccessContext(organizationId, clientSession.userId);
    assertAnyOrganizationPermission(access, permissions[permission]);
  }
  const { data: organization, error } = await createAdminClient().from("organizations")
    .select("id,name,slug,status,metadata").eq("id", organizationId).maybeSingle();
  if (error) throw error;
  if (!organization || organization.status !== "active" || !isRealEstateOrganization(organization)) throw new Error("This workspace is not an active real-estate organization.");
  return { organizationId, name: String(organization.name), slug: String(organization.slug), actorId: adminSession?.email || clientSession!.userId,
    isPlatformAdmin: Boolean(adminSession), permission };
}
