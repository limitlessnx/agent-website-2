import { redirect } from "next/navigation";
import { Bell, CalendarDays } from "lucide-react";
import { getAdminSession } from "@/lib/admin-auth";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ThemeToggle from "@/components/admin/ThemeToggle";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard");

  return (
    <div className="admin-shell">
      <AdminSidebar email={session.email} />
      <section className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">Admin / Dashboard</div>
          <AdminSearch />
          <div className="admin-topbar-actions">
            <button type="button" className="admin-icon-button" aria-label="Notifications" title="Notifications">
              <Bell size={17} />
            </button>
            <ThemeToggle />
            <div className="admin-period">
              <CalendarDays size={15} />
              <span>Live Ops</span>
            </div>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
