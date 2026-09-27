import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { getOrganizationUnreadNotificationCount, syncLifecycleDashboardNotifications } from "@/lib/dashboard-notifications";
import { getPortalCapabilities } from "@/lib/portal-access";
import { LeoConversationProvider } from "@/components/leo/LeoConversationContext";
import TenantLeoFloatingButton from "@/components/portal/TenantLeoFloatingButton";
import PortalSidebar from "./PortalSidebar";
import ClientLogoutButton from "./ClientLogoutButton";
import "./portal.css";
import "./marketplace.css";

export const dynamic = "force-dynamic";

export default async function PortalLayout({children}:{children:React.ReactNode}) {
  const session=await getClientSession();
  if(!session)redirect("/account/login");

  const [profile,capabilities]=await Promise.all([
    getClientOnboardingProfile(session.organizationId).catch(()=>null),
    getPortalCapabilities(session),
  ]);
  if(!profile||profile.status==="in_progress")redirect("/onboarding");

  await syncLifecycleDashboardNotifications(session.organizationId).catch(()=>undefined);
  const unreadNotifications=await getOrganizationUnreadNotificationCount(session.organizationId,session.userId).catch(()=>0);

  return <LeoConversationProvider>
    <div className="portal-shell">
      <PortalSidebar
        organization={profile.business_name||session.organizationSlug}
        role={capabilities.role}
        unreadNotifications={unreadNotifications}
        capabilities={{
          customers:capabilities.customers,
          conversations:capabilities.conversations,
          systems:capabilities.systems,
          appointments:capabilities.appointments,
          analytics:capabilities.analytics,
          team:capabilities.team,
          support:capabilities.support,
        }}
      />
      <section className="portal-main">
        <header className="portal-topbar"><div><span>Client workspace</span><strong>{profile.business_name||session.organizationSlug}</strong></div><ClientLogoutButton/></header>
        {children}
      </section>
      <TenantLeoFloatingButton/>
    </div>
  </LeoConversationProvider>;
}
