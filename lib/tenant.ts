import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireTenant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
