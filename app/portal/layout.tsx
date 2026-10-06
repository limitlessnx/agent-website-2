import { redirect } from "next/navigation";
import { getClientSession, getActiveManagerOrganizations } from "@/lib/client-auth";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { getOrganizationUnreadNotificationCount, syncLifecycleDashboardNotifications } from "@/lib/dashboard-notifications";
import { getPortalCapabilities } from "@/lib/portal-access";
import { getIndustryExperience } from "@/lib/industryExperience";
import { LeoConversationProvider } from "@/components/leo/LeoConversationContext";
import TenantLeoFloatingButton from "@/components/portal/TenantLeoFloatingButton";
import PortalSidebar from "./PortalSidebar";
import ManagerWorkspaceSwitcher from "./ManagerWorkspaceSwitcher";
import ClientLogoutButton from "./ClientLogoutButton";
import "./portal.css";
import "./marketplace.css";

export const dynamic = "force-dynamic";

export default async function PortalLayout({children}:{children:React.ReactNode}) {
  const session=await getClientSession();
  if(!session)redirect("/account/login");

  const [profile,capabilities,managerOrganizations]=await Promise.all([
    getClientOnboardingProfile(session.organizationId).catch(()=>null),
    getPortalCapabilities(session),
    session.role === "manager" ? getActiveManagerOrganizations(session.userId).catch(()=>[]) : Promise.resolve([]),
  ]);
  if(!profile||profile.status==="in_progress")redirect("/onboarding");
  const experience=getIndustryExperience(profile.industry);

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
        experience={experience}
      />
      <section className="portal-main">
        <header className="portal-topbar"><div><span>{experience.name} workspace</span><strong>{profile.business_name||session.organizationSlug}</strong></div><div className="portal-topbar-actions">{session.role === "manager" ? <ManagerWorkspaceSwitcher organizations={managerOrganizations} currentOrganizationId={session.organizationId}/> : null}<ClientLogoutButton/></div></header>
        {children}
      </section>
      <TenantLeoFloatingButton/>
    </div>
  </LeoConversationProvider>;
}
