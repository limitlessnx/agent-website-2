"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  Building2,
  ChevronDown,
  CreditCard,
  Home,
  Image,
  Megaphone,
  Menu,
  MessageCircle,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react";
import LogoutButton from "@/components/admin/LogoutButton";
import styles from "@/components/admin/AdminSidebar.module.css";

const groups = [
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Overview", icon: Home, exact: true },
      { href: "/dashboard/clients", label: "Client Onboarding", icon: Users },
    ],
  },
  {
    id: "limitless-realty",
    label: "Limitless Realty",
    items: [
      { href: "/dashboard/limitless/leads", label: "Leads", icon: Users },
      { href: "/dashboard/limitless/followups", label: "Follow-ups", icon: MessageCircle },
      { href: "/dashboard/limitless/properties", label: "Properties", icon: Building2 },
      { href: "/dashboard/limitless/media", label: "Media Library", icon: Image },
      { href: "/dashboard/limitless/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/dashboard/limitless/payments", label: "Payments & Installments", icon: CreditCard },
    ],
  },
  {
    id: "automation-platform",
    label: "Automation Platform",
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleGroup(id: string) {
    setOpenGroups((current) => current.includes(id) ? current.filter((groupId) => groupId !== id) : [...current, id]);
  }

  return (
    <>
      {!mobileOpen ? (
        <button type="button" className={styles.mobileToggle} onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" aria-expanded={false}>
          <Menu size={21} />
        </button>
      ) : null}

      {mobileOpen ? <button className={styles.backdrop} type="button" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`admin-sidebar ${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.mobileHeader}>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu"><X size={20} /></button>
        </div>

        <Link href="/dashboard" className={`admin-brand ${styles.brand}`}>
          <span className="admin-brand-mark"><BarChart3 size={18} /></span>
          <span>Limitless OS<small>Operations Console</small></span>
        </Link>

        <nav className={`admin-nav ${styles.nav}`} aria-label="Admin navigation">
          {groups.map((group) => {
            const isOpen = openGroups.includes(group.id);
            const hasActiveItem = group.items.some((item) => itemIsActive(pathname, item));
            return (
              <section key={group.id} className={`${styles.group} ${hasActiveItem ? styles.groupActive : ""}`}>
                <button type="button" className={styles.trigger} onClick={() => toggleGroup(group.id)} aria-expanded={isOpen} aria-controls={`admin-nav-${group.id}`}>
                  <span>{group.label}</span>
                  <ChevronDown size={15} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} />
                </button>
                <div id={`admin-nav-${group.id}`} className={`${styles.items} ${isOpen ? styles.itemsOpen : ""}`}>
                  {group.items.map((item) => {
                    const active = itemIsActive(pathname, item);
                    return (
                      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
                        <item.icon size={17} /><span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className={`admin-sidebar-footer ${styles.footer}`}>
          <p>{email}</p>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
