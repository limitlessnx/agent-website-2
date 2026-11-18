import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrganizationId } from "@/lib/organization-context-catalog";
import { getTenantReadiness } from "@/lib/tenant-readiness-server";

export async function getAdminProvisioningDetail(organizationId: string) {
  if (!await getAdminSession()) throw new Error("Platform administrator access required.");
  if (!isOrganizationId(organizationId)) throw new Error("Invalid organization.");
  const admin = createAdminClient();
  const organization = await admin.from("organizations").select("id,name,slug,status").eq("id", organizationId).maybeSingle();
  if (organization.error) throw new Error("Organization evidence unavailable.");
  if (!organization.data) return null;
  const [readiness, members, subscription, templates, jobs] = await Promise.all([
    getTenantReadiness(organizationId),
    admin.from("organization_memberships").select("id,user_id,status,membership_roles(roles(slug))").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(101),
    admin.from("organization_subscriptions").select("status,current_period_end,trial_ends_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1),
    admin.from("organization_template_assignments").select("id,status,organization_templates(name,industry)").eq("organization_id", organizationId).limit(21),
    admin.from("automation_provisioning_jobs").select("id,status,attempts,max_attempts,updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(21),
  ]);
  return {
    organization: organization.data, readiness,
    members: members.error ? null : (members.data || []).slice(0, 100),
    membersTruncated: (members.data?.length || 0) > 100,
    subscription: subscription.error ? undefined : subscription.data?.[0] || null,
    templates: templates.error ? null : (templates.data || []).slice(0, 20),
    templatesTruncated: (templates.data?.length || 0) > 20,
    jobs: jobs.error ? null : (jobs.data || []).slice(0, 20), jobsTruncated: (jobs.data?.length || 0) > 20,
  };
}
