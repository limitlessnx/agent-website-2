import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminSidebar from "@/components/admin/AdminSidebar";
import WorkspaceRail from "@/components/admin/WorkspaceRail";
import LeoFloatingButton from "@/components/admin/LeoFloatingButton";
import ThemeToggle from "@/components/admin/ThemeToggle";
import PlatformChrome from "@/components/admin/PlatformChrome";
import EnterpriseTableEnhancer from "@/components/admin/EnterpriseTableEnhancer";
import MobileAdminHeader from "@/components/admin/MobileAdminHeader";
import MobileBottomNav from "@/components/admin/MobileBottomNav";
import { MobileNavigationProvider } from "@/components/admin/MobileNavigationContext";
import { LeoConversationProvider } from "@/components/leo/LeoConversationContext";
import enterprise from "@/components/admin/EnterprisePlatform.module.css";
import desktop from "@/components/admin/SuperAdminDesktop.module.css";
import mobilePolish from "@/components/admin/MobileAdminPolish.module.css";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard");
  const tenants = await listClientOnboardingProfiles(100).catch(() => []);

  return (
    <div className={`${enterprise.platform} ${desktop.desktopChrome} ${mobilePolish.mobilePolish}`}>
      <MobileNavigationProvider>
        <LeoConversationProvider>
          <MobileAdminHeader />
          <div className="admin-shell fluxknight-platform-shell">
            <AdminSidebar
              email={session.email}
              tenants={tenants.map((tenant) => ({
                id: tenant.id,
                organizationId: tenant.organization_id,
                name: tenant.business_name || tenant.business_email || "Unnamed tenant",
                status: tenant.status,
              }))}
            />
            <section className="admin-main">
              <header className="admin-topbar">
                <div className="admin-breadcrumb"><strong>Fluxknight</strong><span>Workspace Operations</span></div>
                <AdminSearch />
                <div className="admin-topbar-actions">
                  <a href="/" target="_blank" rel="noreferrer" title="Open Fluxknight homepage in a new tab" className="admin-period"><span aria-hidden="true">Home</span><span>Homepage</span><span aria-hidden="true">Open</span></a>
                  <PlatformChrome /><ThemeToggle /><div className="admin-period"><span aria-hidden="true">Live</span><span>Live Ops</span></div>
                </div>
              </header>
              <WorkspaceRail />
              {children}
              <EnterpriseTableEnhancer />
            </section>
            <LeoFloatingButton />
            <MobileBottomNav />
          </div>
        </LeoConversationProvider>
      </MobileNavigationProvider>
    </div>
  );
}
