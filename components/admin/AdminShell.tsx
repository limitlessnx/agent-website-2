import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import { getAdminOrganizationContext } from "@/lib/admin-organization-context";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminSidebar from "@/components/admin/AdminSidebar";
import WorkspaceRail from "@/components/admin/WorkspaceRail";
import LeoFloatingButton from "@/components/admin/LeoFloatingButton";
import PlatformChrome from "@/components/admin/PlatformChrome";
import EnterpriseTableEnhancer from "@/components/admin/EnterpriseTableEnhancer";
import MobileAdminHeader from "@/components/admin/MobileAdminHeader";
import MobileBottomNav from "@/components/admin/MobileBottomNav";
import { MobileNavigationProvider } from "@/components/admin/MobileNavigationContext";
import { LeoConversationProvider } from "@/components/leo/LeoConversationContext";
import design from "@/components/admin/DashboardDesignSystem.module.css";
import enterprise from "@/components/admin/EnterprisePlatform.module.css";
import desktop from "@/components/admin/SuperAdminDesktop.module.css";
import mobilePolish from "@/components/admin/MobileAdminPolish.module.css";
import referenceFidelity from "@/components/admin/DashboardReferenceFidelity.module.css";


export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard");
  const [tenants, organizationContext] = await Promise.all([
    listClientOnboardingProfiles(100).catch(() => []),
    getAdminOrganizationContext(),
  ]);
  const selectedTenant = organizationContext.kind === "tenant"
    ? tenants.find((tenant) => tenant.organization_id === organizationContext.id)
    : null;
  const activeOrganization: { kind: "system" | "tenant"; id: string; name: string } = {
    kind: organizationContext.kind,
    id: organizationContext.id,
    name: selectedTenant?.business_name || selectedTenant?.business_email || (organizationContext.kind === "system" ? organizationContext.name : undefined) || "Tenant organization",
  };

  return (
    <div id="dashboard-theme-root" data-dashboard-theme="dark" className={`${design.designSystem} ${enterprise.platform} ${desktop.desktopChrome} ${mobilePolish.mobilePolish} ${referenceFidelity.referenceFidelity}`}>
      <MobileNavigationProvider>
        <LeoConversationProvider>
          <MobileAdminHeader />
          <div className="admin-shell fluxknight-platform-shell">
            <AdminSidebar
              email={session.email}
              activeOrganization={activeOrganization}
              tenants={tenants.map((tenant) => ({
                id: tenant.id,
                organizationId: tenant.organization_id,
                name: tenant.business_name || tenant.business_email || "Unnamed tenant",
                status: tenant.status,
              }))}
            />
            <section className="admin-main">
              <header className="admin-topbar">
                <div className="admin-breadcrumb"><strong>{activeOrganization.name}</strong><span>{activeOrganization.kind === "system" ? "System Organization" : "Tenant Organization"}</span></div>
                <AdminSearch />
                <div className="admin-topbar-actions">
                  <a href="/" target="_blank" rel="noreferrer" title="Open Fluxknight homepage in a new tab" className="admin-period"><span aria-hidden="true">Home</span><span>Homepage</span><span aria-hidden="true">Open</span></a>
                  <PlatformChrome /><div className="admin-period"><span aria-hidden="true">Live</span><span>Live Ops</span></div>
                </div>
              </header>
              <WorkspaceRail activeOrganization={activeOrganization} />
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
