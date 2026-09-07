import { redirect } from "next/navigation";
import { Bell } from "@/components/admin/ServerIcons";
import { getClientSession } from "@/lib/client-auth";
import { listOrganizationDashboardNotifications, syncLifecycleDashboardNotifications } from "@/lib/dashboard-notifications";
import NotificationCenter from "./NotificationCenter";

export const dynamic = "force-dynamic";

export default async function ClientNotificationsPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");

  await syncLifecycleDashboardNotifications(session.organizationId).catch(() => undefined);
  const notifications = await listOrganizationDashboardNotifications(session.organizationId, session.userId, 100).catch(() => []);
  const unread = notifications.filter((item) => !item.readAt && !item.resolvedAt).length;
  const critical = notifications.filter((item) => item.severity === "critical" && !item.resolvedAt).length;

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div><span className="portal-kicker">Workspace notifications</span><h1>Notification Center</h1><p>Account, support, integration and lifecycle notices stay here so routine operational updates do not have to become email.</p></div>
        <span className={critical ? "portal-status warning" : "portal-status"}><Bell size={15} /> {critical ? `${critical} critical` : `${unread} unread`}</span>
      </header>
      <NotificationCenter initialNotifications={notifications} />
    </main>
  );
}
