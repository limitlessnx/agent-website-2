import { createAdminClient } from "@/lib/supabase/admin";

export type OrganizationPackageSnapshot = {
  assignment: Record<string, unknown> | null;
  servicePackage: Record<string, unknown> | null;
  packageEntitlements: Array<Record<string, unknown>>;
  organizationOverrides: Array<Record<string, unknown>>;
};

export async function getOrganizationPackageSnapshot(organizationId: string): Promise<OrganizationPackageSnapshot> {
  const admin = createAdminClient();

  const { data: assignment, error: assignmentError } = await admin
    .from("organization_service_packages")
    .select("id,organization_id,service_package_id,status,source,starts_at,ends_at,metadata")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .lte("starts_at", new Date().toISOString())
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (assignmentError) throw assignmentError;

  let servicePackage: Record<string, unknown> | null = null;
  let packageEntitlements: Array<Record<string, unknown>> = [];

  if (assignment?.service_package_id) {
    const [{ data: pkg, error: packageError }, { data: entitlements, error: entitlementError }] = await Promise.all([
      admin.from("service_packages").select("id,name,slug,description,status,metadata").eq("id", assignment.service_package_id).maybeSingle(),
      admin.from("service_package_entitlements").select("feature_key,enabled,limit_value,configuration").eq("service_package_id", assignment.service_package_id).order("feature_key"),
    ]);
    if (packageError) throw packageError;
    if (entitlementError) throw entitlementError;
    servicePackage = pkg || null;
    packageEntitlements = (entitlements || []) as Array<Record<string, unknown>>;
  }

  const { data: overrides, error: overridesError } = await admin
    .from("organization_entitlements")
    .select("feature_key,enabled,limit_value,source,expires_at,configuration")
    .eq("organization_id", organizationId)
    .order("feature_key");
  if (overridesError) throw overridesError;

  return {
    assignment: assignment || null,
    servicePackage,
    packageEntitlements,
    organizationOverrides: (overrides || []) as Array<Record<string, unknown>>,
  };
}

export async function listServicePackages() {
  const { data, error } = await createAdminClient()
    .from("service_packages")
    .select("id,name,slug,description,status,metadata")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function assignOrganizationServicePackage(input: {
  organizationId: string;
  packageSlug: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("assign_service_package_to_organization", {
    p_organization_id: input.organizationId,
    p_package_slug: input.packageSlug,
    p_actor_user_id: null,
    p_metadata: input.metadata || {},
  });
  if (error) throw error;
  return data;
}
