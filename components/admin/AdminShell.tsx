import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminSidebar from "@/components/admin/AdminSidebar";
import LeoFloatingButton from "@/components/admin/LeoFloatingButton";
import ThemeToggle from "@/components/admin/ThemeToggle";
import EnterpriseTableEnhancer from "@/components/admin/EnterpriseTableEnhancer";
import MobileAdminHeader from "@/components/admin/MobileAdminHeader";
import MobileBottomNav from "@/components/admin/MobileBottomNav";
import { MobileNavigationProvider } from "@/components/admin/MobileNavigationContext";
import { LeoConversationProvider } from "@/components/leo/LeoConversationContext";
import enterprise from "@/components/admin/EnterprisePlatform.module.css";
import desktop from "@/components/admin/SuperAdminDesktop.module.css";
import mobilePolish from "@/components/admin/MobileAdminPolish.module.css";
import shell from "@/components/admin/DashboardShell.module.css";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard");
  const tenants = await listClientOnboardingProfiles(100).catch(() => []);

  return (
    <div className={`${enterprise.platform} ${desktop.desktopChrome} ${mobilePolish.mobilePolish} ${shell.shell}`}>
      <MobileNavigationProvider>
        <LeoConversationProvider>
          <MobileAdminHeader />
          <div className={`admin-shell fluxknight-platform-shell ${shell.frame}`}>
            <AdminSidebar
              email={session.email}
              tenants={tenants.map((tenant) => ({
                id: tenant.id,
                organizationId: tenant.organization_id,
                name: tenant.business_name || tenant.business_email || "Unnamed tenant",
                status: tenant.status,
              }))}
            />
            <section className={`admin-main ${shell.main}`}>
              <header className={shell.topbar}>
                <div className={shell.context}>
                  <strong>Fluxknight</strong>
                  <span>Workspace operations</span>
                </div>
                <div className={shell.search}><AdminSearch /></div>
                <div className={shell.actions}><ThemeToggle /></div>
              </header>
              <div className={shell.content}>
                <div className={shell.contentInner}>{children}</div>
              </div>
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
