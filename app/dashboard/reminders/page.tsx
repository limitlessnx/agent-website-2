import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import ReminderRulesManager from "@/components/admin/ReminderRulesManager";
import AppointmentReminderInbox from "@/components/admin/AppointmentReminderInbox";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  const scope = await resolveAdminOrganizationScope();
  if (scope.status !== "active" || scope.organizationId.startsWith("unavailable:")) {
    return <main className="admin-page"><h1>Reminders & Automations</h1><p>Switch to an active organization workspace to manage reminder rules.</p><Link href="/dashboard">Back to dashboard</Link></main>;
  }
  return <main className="admin-page"><header style={{ marginBottom: 24 }}><p style={{ color: "var(--fk-muted, #777)", marginBottom: 6 }}>WORKSPACE AUTOMATION</p><h1 style={{ margin: 0 }}>Reminders & Automations</h1><p>Create date-based, recurring, or event-triggered rules for {scope.name}.</p></header><ReminderRulesManager organizationName={scope.name} /><AppointmentReminderInbox /></main>;
}
