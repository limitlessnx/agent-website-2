"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Activity, ArrowLeft, ArrowRight, Bot, BrainCircuit, Building2, ChevronDown, ClipboardList,
  CreditCard, Database, ExternalLink, Gauge, Globe2, Home, LifeBuoy, LineChart, Megaphone,
  MessageSquareText, Plus, Search, Settings, ShieldCheck, Target, Users, X,
} from "@/components/admin/ServerIcons";
import LogoutButton from "@/components/admin/LogoutButton";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import FluxknightMark from "@/components/admin/FluxknightMark";
import ThemeToggle from "@/components/admin/ThemeToggle";
import { useMobileNavigation } from "@/components/admin/MobileNavigationContext";
import {
  ADMIN_NAV_GROUPS,
  PUBLIC_SITE_NAV,
  getActiveAdminNavGroup,
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
  "/dashboard/conversations": MessageSquareText,
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
  "/dashboard/onboarding#new-client": Plus,
  "/dashboard/clients": Users,
};

function sectionWithIcons(section: AdminNavSection): NavSection {
  return {
    ...section,
    items: section.items.map((item) => ({
      ...item,
      icon: ICON_BY_HREF[item.href] || Building2,
    })),
  };
}

function withIcons(group: AdminNavGroup): NavGroup {
  return {
    ...group,
    sections: group.sections.map((section) => sectionWithIcons(section)),
  };
}

function groupItems(group: NavGroup) {
  return group.sections.flatMap((section) => section.items);
}

function sectionId(groupId: string, section: AdminNavSection, sectionIndex: number) {
  return section.label
    ? `${groupId}:${section.label.toLowerCase().replaceAll(" ", "-")}`
    : `${groupId}:${sectionIndex}`;
}

export default function AdminSidebar({ email, tenants }: { email: string; tenants: TenantNavItem[] }) {
  const pathname = usePathname();
  const platformGroups = useMemo<NavGroup[]>(() => ADMIN_NAV_GROUPS.map((group) => withIcons(group)), []);
  const activeGroupId = getActiveAdminNavGroup(pathname);
  const [openGroups, setOpenGroups] = useState<string[]>(() => (activeGroupId ? [activeGroupId] : ["overview"]));
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [publicSiteOpen, setPublicSiteOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { open: mobileOpen, closeMenu } = useMobileNavigation();

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((current) => current.includes(activeGroupId) ? current : [...current, activeGroupId]);
  }, [activeGroupId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fluxknight-dashboard-sidebar");
      const next = saved === "collapsed";
      setCollapsed(next);
      const root = document.getElementById("dashboard-theme-root");
      if (root) root.dataset.sidebarCollapsed = String(next);
    } catch (_) {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem("fluxknight-dashboard-sidebar", next ? "collapsed" : "expanded");
        const root = document.getElementById("dashboard-theme-root");
        if (root) root.dataset.sidebarCollapsed = String(next);
      } catch (_) {}
      return next;
    });
  }

  function toggleGroup(id: string) {
    setOpenGroups((current) => current.includes(id) ? current.filter((groupId) => groupId !== id) : [...current, id]);
  }

  function toggleSection(id: string) {
    setOpenSections((current) => current.includes(id) ? current.filter((section) => section !== id) : [...current, id]);
  }

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
        <span className={styles.mobileMenuTitle}>Navigation</span>
        <div><ThemeToggle /><button type="button" onClick={closeMenu} aria-label="Close navigation menu"><X size={20} /></button></div>
      </div>

      <div className={styles.brandRow}>
        <Link href="/dashboard" onClick={closeMenu} className={`admin-brand ${styles.brand} ${extras.brandLockup}`}>
          <FluxknightLogo className={extras.wordmark} />
          <FluxknightMark className={styles.compactLogo} />
          <small>Serve Better. Operate Smarter.</small>
        </Link>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
        </button>
      </div>

      <div className={extras.workspaceWrap}>
        <button type="button" className={extras.workspaceSwitcher} onClick={() => setWorkspaceOpen((current) => !current)} aria-expanded={workspaceOpen}>
          <span className={extras.workspaceIcon}><Building2 size={16} /></span>
          <span><small>Current workspace</small><strong>{workspaceName}</strong></span>
          <ChevronDown size={15} className={workspaceOpen ? extras.workspaceChevronOpen : extras.workspaceChevron} />
        </button>
        {workspaceOpen ? <div className={extras.workspaceMenu}>
          {workspaceLinks.map((workspace) => <Link key={workspace.href} href={workspace.href} onClick={() => { setWorkspaceOpen(false); closeMenu(); }}>
            <span><strong>{workspace.label}</strong><small>{workspace.meta}</small></span>
          </Link>)}
          <Link href="/dashboard/clients" onClick={() => { setWorkspaceOpen(false); closeMenu(); }} className={extras.manageWorkspaces}>
            <Search size={14} /><span>Browse all workspaces</span>
          </Link>
        </div> : null}
      </div>

      <nav className={`admin-nav ${styles.nav}`} aria-label="Dashboard navigation">
        {platformGroups.map((group) => {
          const hasActiveItem = groupItems(group).some((item) => isAdminNavItemActive(pathname, item.href, item.exact));
          const isOpen = openGroups.includes(group.id);
          return <section key={group.id} data-nav-group={group.id} className={`${styles.group} ${hasActiveItem ? styles.groupActive : ""}`}>
            <button type="button" className={styles.trigger} onClick={() => toggleGroup(group.id)} aria-expanded={isOpen}>
              <span className={styles.triggerLabel}>{group.label}</span>
              <ChevronDown size={15} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} />
            </button>
            <div className={`${styles.items} ${isOpen ? styles.itemsOpen : ""}`}>
              {group.sections.map((section, sectionIndex) => {
                const nestedSectionId = sectionId(group.id, section, sectionIndex);
                const hasActiveSectionItem = section.items.some((item) => isAdminNavItemActive(pathname, item.href, item.exact));
                const isSectionOpen = openSections.includes(nestedSectionId);
                return <div key={nestedSectionId} className={styles.section}>
                  {section.label ? <button type="button" className={`${styles.sectionTrigger} ${hasActiveSectionItem ? styles.sectionTriggerActive : ""}`} onClick={() => toggleSection(nestedSectionId)} aria-expanded={isSectionOpen}><span className={styles.sectionLabelText}>{section.label}</span><ChevronDown size={14} className={`${styles.chevron} ${isSectionOpen ? styles.chevronOpen : ""}`} /></button> : null}
                  <div className={`${section.label ? styles.sectionItems : ""} ${!section.label || isSectionOpen ? styles.sectionItemsOpen : ""}`}>
                    {section.items.map((item) => {
                      const active = isAdminNavItemActive(pathname, item.href, item.exact);
                      return <Link key={item.href} href={item.href} onClick={closeMenu} aria-current={active ? "page" : undefined}>
                        <item.icon size={17} /><span>{item.label}</span>{item.meta ? <small>{item.meta}</small> : null}
                      </Link>;
                    })}
                  </div>
                </div>;
              })}
            </div>
          </section>;
        })}

        <section className={styles.group}>
          <button type="button" className={styles.trigger} onClick={() => setPublicSiteOpen((current) => !current)} aria-expanded={publicSiteOpen}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Globe2 size={15} /> Public Website</span>
            <ChevronDown size={15} className={`${styles.chevron} ${publicSiteOpen ? styles.chevronOpen : ""}`} />
          </button>
          <div className={`${styles.items} ${publicSiteOpen ? styles.itemsOpen : ""}`}>
            <div className={styles.section}><div className={styles.sectionItemsOpen}>
              {PUBLIC_SITE_NAV.map((item) => <a key={item.href} href={item.href} target="_blank" rel="noreferrer" onClick={closeMenu}><ExternalLink size={16} /><span>{item.label}</span></a>)}
            </div></div>
          </div>
        </section>
      </nav>

      <div className={`admin-sidebar-footer ${styles.footer}`}>
        <div className={extras.userCard}><span><Database size={15} /></span><div><strong>Platform Admin</strong><small>{email}</small></div></div>
        <LogoutButton />
      </div>
    </aside>
  </>;
}
