import { redirect } from "next/navigation";
import Link from "next/link";
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
import FluxLogo from "@/components/FluxLogo";
import { Bell } from "lucide-react";
import hotelStyles from "@/components/portal/hotel/HotelMobileShell.module.css";
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
  if(!profile)redirect("/onboarding");
  const experience=getIndustryExperience(profile.industry);

  await syncLifecycleDashboardNotifications(session.organizationId).catch(()=>undefined);
  const unreadNotifications=await getOrganizationUnreadNotificationCount(session.organizationId,session.userId).catch(()=>0);

  return <LeoConversationProvider>
    <div className={`portal-shell ${experience.slug==="hotels"?hotelStyles.shell:""}`}>
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
          billing:capabilities.billing,
          team:capabilities.team,
          support:capabilities.support,
        }}
        experience={experience}
      />
      <section className="portal-main">
        <header className="portal-topbar">{experience.slug==="hotels"?<Link href="/portal" className={hotelStyles.mobileBrand} aria-label="Fluxknight hotel home"><FluxLogo/><small>Hotel &amp; Hospitality</small></Link>:null}<div className={experience.slug==="hotels"?hotelStyles.desktopIdentity:undefined}><span>{experience.name} workspace</span><strong>{profile.business_name||session.organizationSlug}</strong></div><div className="portal-topbar-actions">{experience.slug==="hotels"?<><Link href="/portal/notifications" className={hotelStyles.mobileAction} aria-label={`${unreadNotifications} unread notifications`}><Bell size={20}/>{unreadNotifications>0?<em>{unreadNotifications>99?"99+":unreadNotifications}</em>:null}</Link><Link href="/portal/settings" className={`${hotelStyles.mobileAction} ${hotelStyles.avatar}`} aria-label="Hotel settings">{(profile.business_name||session.organizationSlug).split(/\s+/).slice(0,2).map(word=>word[0]||"").join("").toUpperCase()}</Link></>:null}{session.isAdminPreview ? <Link prefetch={false} className="portal-button secondary" href="/dashboard/preview/exit">Exit tenant preview</Link> : null}{session.role === "manager" ? <ManagerWorkspaceSwitcher organizations={managerOrganizations} currentOrganizationId={session.organizationId}/> : null}{session.isAdminPreview ? null : <ClientLogoutButton/>}</div></header>
        {children}
      </section>
      {session.isAdminPreview ? null : <TenantLeoFloatingButton/>}
    </div>
  </LeoConversationProvider>;
}
