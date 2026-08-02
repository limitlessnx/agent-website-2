import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function requireTenant() {
  const supabase = await createClient();
  const adminSession = await getAdminSession();

  if (adminSession) {
    const admin = createAdminClient();
    const preferredSlug = process.env.ADMIN_ORGANIZATION_SLUG || process.env.LIMITLESS_ADMIN_ORGANIZATION_SLUG || "fluxknight";
    const preferred = await admin
      .from("organizations")
      .select("id,name,slug,status")
      .eq("slug", preferredSlug)
      .maybeSingle();
    const fallback = preferred.data ? null : await admin
      .from("organizations")
      .select("id,name,slug,status")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const organization = preferred.data || fallback?.data;
    if (!organization) redirect("/login?error=no-organization");

    return {
      supabase: admin,
      user: { id: adminSession.email, email: adminSession.email },
      organizationId: organization.id as string,
      branchId: null,
      organization: organization as {
        id: string;
        name: string;
        slug: string;
        status: string;
      },
    };
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, branch_id, organizations(id,name,slug,status)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !membership) redirect("/login?error=no-organization");

  return {
    supabase,
    user,
    organizationId: membership.organization_id as string,
    branchId: membership.branch_id as string | null,
    organization: membership.organizations as unknown as {
      id: string;
      name: string;
      slug: string;
      status: string;
    },
  };
}
