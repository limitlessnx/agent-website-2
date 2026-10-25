import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import TenantContactsManager from "@/components/admin/TenantContactsManager";
export const dynamic = "force-dynamic";
export default async function TenantContactsPage() {
  if (!(await getAdminSession())) redirect("/login");
  const scope = await resolveAdminOrganizationScope();
  if (scope.status !== "active" || scope.organizationId.startsWith("unavailable:")) {
    return <main className="admin-page"><h1>Customer Contacts</h1><p>Switch to an active organization workspace to manage customer contacts.</p><Link href="/dashboard">Back to dashboard</Link></main>;
  }
  return <main className="admin-page"><header style={{marginBottom:24}}><p style={{color:"var(--fk-muted, #777)",marginBottom:6}}>WORKSPACE CRM</p><h1 style={{margin:0}}>Customer Contacts</h1><p>Manage client contact details, birthdays, anniversaries, and messaging consent for {scope.name}.</p><Link href="/dashboard/reminders">Go to reminders</Link></header><TenantContactsManager organizationName={scope.name}/></main>;
}
