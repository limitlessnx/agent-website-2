import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bot,
  Building2,
  Home,
  Image,
  Megaphone,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import { getAdminSession } from "@/lib/admin-auth";
import LogoutButton from "@/components/admin/LogoutButton";

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
          <span>Limitless OS</span>
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
      <section className="admin-main">{children}</section>
    </div>
  );
}
