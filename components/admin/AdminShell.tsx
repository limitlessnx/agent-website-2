import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Home,
  Image,
  Megaphone,
  MessageCircle,
  Search,
  Settings,
  Users,
  Bell,
} from "lucide-react";
import { getAdminSession } from "@/lib/admin-auth";
import LogoutButton from "@/components/admin/LogoutButton";
import ThemeToggle from "@/components/admin/ThemeToggle";

const nav = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/limitless/leads", label: "Leads", icon: Users },
  { href: "/dashboard/limitless/properties", label: "Properties", icon: Building2 },
  { href: "/dashboard/limitless/media", label: "Media", icon: Image },
  { href: "/dashboard/limitless/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/limitless/followups", label: "Follow-ups", icon: MessageCircle },
  { href: "/dashboard/automations", label: "Automations", icon: Bot },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard");

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/dashboard" className="admin-brand">
          <span className="admin-brand-mark"><BarChart3 size={18} /></span>
          <span>
            Limitless OS
            <small>Realty Admin</small>
          </span>
        </Link>
        <nav className="admin-nav">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <p>{session.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">Admin / Dashboard</div>
          <div className="admin-search">
            <Search size={16} />
            <span>Search leads, properties, campaigns...</span>
          </div>
          <div className="admin-topbar-actions">
            <button type="button" className="admin-icon-button" aria-label="Notifications" title="Notifications">
              <Bell size={17} />
            </button>
            <ThemeToggle />
            <div className="admin-period">
              <CalendarDays size={15} />
              <span>Launch Mode</span>
            </div>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
