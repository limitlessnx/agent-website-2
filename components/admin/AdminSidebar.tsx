"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentType } from "react";
import {
  Activity, Bot, BrainCircuit, Building2, ChevronDown, ClipboardList,
  CreditCard, Database, Gauge, Home, LifeBuoy, LineChart, Megaphone,
  Search, Settings, ShieldCheck, Target, Users, X,
} from "@/components/admin/ServerIcons";
import LogoutButton from "@/components/admin/LogoutButton";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import ThemeToggle from "@/components/admin/ThemeToggle";
import { useMobileNavigation } from "@/components/admin/MobileNavigationContext";
import {
  ADMIN_NAV_GROUPS,
  isAdminNavItemActive,
  type AdminNavGroup,
  type AdminNavSection,
  type AdminNavItem,
} from "@/components/admin/navigationConfig";
import styles from "@/components/admin/AdminSidebar.module.css";
import extras from "@/components/admin/AdminSidebarExtras.module.css";

type NavItem = AdminNavItem & { icon: ComponentType<{ size?: number }> };
type NavSection = Omit<AdminNavSection, "items"> & { items: NavItem[] };
type NavGroup = Omit<AdminNavGroup, "sections"> & { sections: NavSection[] };
export type TenantNavItem = { id: string; organizationId: string; name: string; status: string };

const ICON_BY_HREF: Record<string, ComponentType<{ size?: number }>> = {
  "/dashboard": Home,
  "/dashboard/control-center": Gauge,
  "/dashboard/lifecycle": Activity,
  "/dashboard/support": LifeBuoy,
  "/dashboard/health": ShieldCheck,
  "/dashboard/value": LineChart,
  "/dashboard/expansion": Target,
  "/dashboard/retention": ShieldCheck,
  "/dashboard/evaluations": ClipboardList,
  "/dashboard/agents": Bot,
  "/dashboard/social": Megaphone,
  "/dashboard/activity": Activity,
  "/dashboard/limitless/leads": Building2,
  "/dashboard/gencouv": LineChart,
  "/dashboard/workflows": Activity,
  "/dashboard/billing": CreditCard,
  "/dashboard/ai-models": BrainCircuit,
  "/dashboard/knowledge": Database,
  "/dashboard/memory": BrainCircuit,
  "/dashboard/settings": Settings,
  "/dashboard/clients": Users,
};

function withIcons(group: AdminNavGroup): NavGroup {
  return {
    ...group,
    sections: group.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, icon: ICON_BY_HREF[item.href] || Building2 })),
    })),
  };
}

export default function AdminSidebar({ email, tenants }: { email: string; tenants: TenantNavItem[] }) {
  const pathname = usePathname();
  const platformGroups = useMemo<NavGroup[]>(() => ADMIN_NAV_GROUPS.map(withIcons), []);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const { open: mobileOpen, closeMenu } = useMobileNavigation();

  const workspaceName = pathname.startsWith("/dashboard/gencouv")
    ? "Gencouv"
    : pathname.startsWith("/dashboard/limitless")
      ? "Limitless Realty"
      : pathname.startsWith("/dashboard/clients") || pathname.startsWith("/dashboard/onboarding")
        ? "Client Workspaces"
        : "Fluxknight";

  const workspaceLinks = [
    { href: "/dashboard", label: "Fluxknight", meta: "Platform" },
    { href: "/dashboard/limitless/leads", label: "Limitless Realty", meta: "Internal workspace" },
    { href: "/dashboard/gencouv", label: "Gencouv", meta: "Internal workspace" },
    ...tenants.slice(0, 6).map((tenant) => ({
      href: `/dashboard/clients?organizationId=${encodeURIComponent(tenant.organizationId)}`,
      label: tenant.name,
      meta: tenant.status.replaceAll("_", " "),
    })),
  ];

  return <>
    <button className={`${styles.backdrop} ${mobileOpen ? styles.backdropOpen : ""}`} type="button" aria-label="Close navigation menu" aria-hidden={!mobileOpen} tabIndex={mobileOpen ? 0 : -1} onClick={closeMenu} />
    <aside id="admin-mobile-navigation" className={`admin-sidebar ${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`} aria-label="Admin navigation">
      <div className={styles.mobileHeader}>
        <span>Navigation</span>
        <div><ThemeToggle /><button type="button" onClick={closeMenu} aria-label="Close navigation menu"><X size={19} /></button></div>
      </div>

      <Link href="/dashboard" onClick={closeMenu} className={`admin-brand ${styles.brand} ${extras.brandLockup}`}>
        <FluxknightLogo className={extras.wordmark} />
        <small>Operate smarter</small>
      </Link>

      <div className={extras.workspaceWrap}>
        <button type="button" className={extras.workspaceSwitcher} onClick={() => setWorkspaceOpen((current) => !current)} aria-expanded={workspaceOpen}>
          <span className={extras.workspaceIcon}><Building2 size={15} /></span>
          <span><small>Workspace</small><strong>{workspaceName}</strong></span>
          <ChevronDown size={14} className={workspaceOpen ? extras.workspaceChevronOpen : extras.workspaceChevron} />
        </button>
        {workspaceOpen ? <div className={extras.workspaceMenu}>
          {workspaceLinks.map((workspace) => <Link key={workspace.href} href={workspace.href} onClick={() => { setWorkspaceOpen(false); closeMenu(); }}>
            <span><strong>{workspace.label}</strong><small>{workspace.meta}</small></span>
          </Link>)}
          <Link href="/dashboard/clients" onClick={() => { setWorkspaceOpen(false); closeMenu(); }} className={extras.manageWorkspaces}>
            <Search size={13} /><span>Browse workspaces</span>
          </Link>
        </div> : null}
      </div>

      <nav className={`admin-nav ${styles.nav}`} aria-label="Dashboard navigation">
        {platformGroups.map((group) => <section key={group.id} className={styles.group}>
          <span className={styles.groupLabel}>{group.label}</span>
          <div className={styles.itemsOpen}>
            {group.sections.flatMap((section) => section.items).map((item) => {
              const active = isAdminNavItemActive(pathname, item.href, item.exact);
              return <Link key={item.href} href={item.href} onClick={closeMenu} aria-current={active ? "page" : undefined}>
                <item.icon size={16} />
                <span>{item.label}</span>
                {item.meta ? <small>{item.meta}</small> : null}
              </Link>;
            })}
          </div>
        </section>)}
      </nav>

      <div className={`admin-sidebar-footer ${styles.footer}`}>
        <div className={extras.userCard}>
          <span><Database size={14} /></span>
          <div><strong>Platform Admin</strong><small>{email}</small></div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  </>;
}
