"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  Building2,
  ChevronDown,
  Home,
  Image,
  Megaphone,
  MessageCircle,
  Settings,
  Users,
  Workflow,
} from "lucide-react";

const groups = [
  {
    id: "operations",
    label: "Operations",
    items: [{ href: "/dashboard", label: "Overview", icon: Home, exact: true }],
  },
  {
    id: "crm-sales",
    label: "CRM & Sales",
    items: [
      { href: "/dashboard/limitless/leads", label: "Leads", icon: Users },
      { href: "/dashboard/limitless/followups", label: "Follow-ups", icon: MessageCircle },
    ],
  },
  {
    id: "real-estate",
    label: "Real Estate",
    items: [
      { href: "/dashboard/limitless/properties", label: "Properties", icon: Building2 },
      { href: "/dashboard/limitless/media", label: "Media Library", icon: Image },
      { href: "/dashboard/limitless/campaigns", label: "Campaigns", icon: Megaphone },
    ],
  },
  {
    id: "automation-ai",
    label: "Automation & AI",
    items: [
      { href: "/dashboard/automations", label: "Automation Control", icon: Bot },
      { href: "/dashboard/workflows", label: "Workflow Registry", icon: Workflow },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
];

function itemIsActive(pathname: string, item: { href: string; exact?: boolean }) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const activeGroupIds = useMemo(
    () => groups.filter((group) => group.items.some((item) => itemIsActive(pathname, item))).map((group) => group.id),
    [pathname],
  );
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroupIds.length ? activeGroupIds : ["operations"]);

  function toggleGroup(id: string) {
    setOpenGroups((current) => current.includes(id) ? current.filter((groupId) => groupId !== id) : [...current, id]);
  }

  return (
    <aside className="admin-sidebar">
      <Link href="/dashboard" className="admin-brand">
        <span className="admin-brand-mark"><BarChart3 size={18} /></span>
        <span>
          Limitless OS
          <small>Operations Console</small>
        </span>
      </Link>

      <nav className="admin-nav" aria-label="Admin navigation">
        {groups.map((group) => {
          const isOpen = openGroups.includes(group.id);
          const hasActiveItem = group.items.some((item) => itemIsActive(pathname, item));
          return (
            <section key={group.id} className={`admin-nav-group${hasActiveItem ? " active" : ""}`}>
              <button
                type="button"
                className="admin-nav-group-trigger"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={`admin-nav-${group.id}`}
              >
                <span>{group.label}</span>
                <ChevronDown size={15} className={isOpen ? "open" : ""} />
              </button>
              <div id={`admin-nav-${group.id}`} className={`admin-nav-group-items${isOpen ? " open" : ""}`}>
                {group.items.map((item) => {
                  const active = itemIsActive(pathname, item);
                  return (
                    <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                      <item.icon size={17} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <p>{email}</p>
      </div>
    </aside>
  );
}
