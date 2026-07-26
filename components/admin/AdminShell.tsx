import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { getAdminSession } from "@/lib/admin-auth";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ThemeToggle from "@/components/admin/ThemeToggle";
import PlatformChrome from "@/components/admin/PlatformChrome";
import EnterpriseTableEnhancer from "@/components/admin/EnterpriseTableEnhancer";
import enterprise from "@/components/admin/EnterprisePlatform.module.css";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard");

  return (
    <div className={enterprise.platform}>
      <div className="admin-shell fluxknight-platform-shell">
        <AdminSidebar email={session.email} />
        <section className="admin-main">
          <header className="admin-topbar">
            <div className="admin-breadcrumb">
              <strong>Fluxknight</strong>
              <span>Limitless Realty / Operations</span>
            </div>
            <AdminSearch />
            <div className="admin-topbar-actions">
              <PlatformChrome />
              <ThemeToggle />
              <div className="admin-period">
                <CalendarDays size={15} />
                <span>Live Ops</span>
              </div>
            </div>
          </header>
          {children}
          <EnterpriseTableEnhancer />
        </section>
      </div>
    </div>
  );
}
