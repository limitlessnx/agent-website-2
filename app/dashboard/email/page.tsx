import { redirect } from "next/navigation";
import { getAdminOrganizationContext } from "@/lib/admin-organization-context";
import EmailWorkspace from "@/components/admin/EmailWorkspace";

export const dynamic = "force-dynamic";
export default async function EmailDashboardPage() {
  const context = await getAdminOrganizationContext();
  if (context.kind !== "system" || context.id !== "fluxknight") redirect("/dashboard");
  return <main className="admin-page"><EmailWorkspace /></main>;
}
