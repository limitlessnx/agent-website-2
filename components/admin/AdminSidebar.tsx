"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentType } from "react";
import {
  Activity, Bell, Bot, BrainCircuit, Building2, ChevronDown, ClipboardList,
  CreditCard, Database, ExternalLink, Globe2, Home, Image, LifeBuoy, LineChart, Mail, Megaphone,
  MessageCircle, Plus, Search, Settings, ShieldCheck, Users, X,
} from "@/components/admin/ServerIcons";
import LogoutButton from "@/components/admin/LogoutButton";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import ThemeToggle from "@/components/admin/ThemeToggle";
import { useMobileNavigation } from "@/components/admin/MobileNavigationContext";
import {
  ADMIN_NAV_GROUPS,
  CLIENT_ONBOARDING_NAV,
  PUBLIC_SITE_NAV,
  buildClientWorkspaceNav,
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
  "/dashboard/support": LifeBuoy,
  "/dashboard/notifications": Bell,
  "/dashboard/evaluations": ClipboardList,
  "/dashboard/agents": Bot,
  "/dashboard/activity": Activity,
  "/dashboard/limitless/leads": Users,
  "/dashboard/limitless/daily-briefs": ClipboardList,
  "/dashboard/limitless/followups": MessageCircle,
  "/dashboard/limitless/properties": Building2,
  "/dashboard/limitless/media": Image,
  "/dashboard/limitless/campaigns": Megaphone,
  "/dashboard/limitless/agentic": BrainCircuit,
  "/dashboard/workflows": Activity,
  "/dashboard/limitless/payments": CreditCard,
  "/dashboard/gencouv": LineChart,
  "/dashboard/gencouv#email-control": Mail,
  "/dashboard/gencouv#gencouv-inbox": MessageCircle,
  "/dashboard/gencouv#lead-board": Users,
  "/dashboard/gencouv#sequence-status": ShieldCheck,
  "/dashboard/gencouv#acquisition": Search,
  "/dashboard/gencouv#operations": Activity,
  "/dashboard/ai-models": BrainCircuit,
  "/dashboard/knowledge": Database,
  "/dashboard/memory": BrainCircuit,
  "/dashboard/settings": Settings,
  "/dashboard/onboarding#new-client": Plus,
  "/dashboard/onboarding#queue": ClipboardList,
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
    sections: group.sections.map(sectionWithIcons),
  };
}

function groupItems(group: NavGroup) { return group.sections.flatMap((section) => section.items); }
function sectionId(groupId: string, section: NavSection, sectionIndex: number) {
  return section.label ? `${groupId}:${section.label.toLowerCase().replaceAll(" ", "-")}` : `${groupId}:${sectionIndex}`;
}

export default function AdminSidebar({ email, tenants }: { email: string; tenants: TenantNavItem[] }) {
  const pathname = usePathname();
  const platformGroups = useMemo<NavGroup[]>(() => {
    const onboarding = withIcons(CLIENT_ONBOARDING_NAV);
    return [
      ...ADMIN_NAV_GROUPS.map(withIcons),
      {
        ...onboarding,
        sections: [
          onboarding.sections[0],
          sectionWithIcons(buildClientWorkspaceNav(tenants)),
        ],
      },
    ];
  }, [tenants]);

  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [publicSiteOpen, setPublicSiteOpen] = useState(false);
  const { open: mobileOpen, closeMenu } = useMobileNavigation();

  function toggleGroup(id: string) { setOpenGroups((current) => current.includes(id) ? current.filter((groupId) => groupId !== id) : [...current, id]); }
  function toggleSection(id: string) { setOpenSections((current) => current.includes(id) ? current.filter((section) => section !== id) : [...current, id]); }

  const workspaceName = pathname.startsWith("/dashboard/gencouv") ? "Gencouv" : pathname.startsWith("/dashboard/limitless") ? "Limitless Realty" : pathname.startsWith("/dashboard/clients") || pathname.startsWith("/dashboard/onboarding") ? "Client Onboarding" : "Fluxknight Platform";

  return <>
    <button className={`${styles.backdrop} ${mobileOpen ? styles.backdropOpen : ""}`} type="button" aria-label="Close navigation menu" aria-hidden={!mobileOpen} tabIndex={mobileOpen ? 0 : -1} onClick={closeMenu} />
    <aside className={`admin-sidebar ${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`} aria-label="Admin navigation">
      <div className={styles.mobileHeader}>
        <span className={styles.mobileMenuTitle}>Navigation</span>
        <div><ThemeToggle /><button type="button" onClick={closeMenu} aria-label="Close navigation menu"><X size={20} /></button></div>
      </div>
      <Link href="/dashboard" onClick={closeMenu} className={`admin-brand ${styles.brand} ${extras.brandLockup}`}><FluxknightLogo className={extras.wordmark} /><small>AI Operations Platform</small></Link>
      <div className={extras.workspaceSwitcher}>
        <span className={extras.workspaceIcon}><Building2 size={16} /></span>
        <span><small>Current scope</small><strong>{workspaceName}</strong></span>
      </div>
      <nav className={`admin-nav ${styles.nav}`} aria-label="Platform, home agent, client onboarding and public website navigation">
        <section className={styles.group}>
          <button type="button" className={styles.trigger} onClick={() => setPublicSiteOpen((current) => !current)} aria-expanded={publicSiteOpen}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Globe2 size={15} /> Public Website</span>
            <ChevronDown size={15} className={`${styles.chevron} ${publicSiteOpen ? styles.chevronOpen : ""}`} />
          </button>
          <div className={`${styles.items} ${publicSiteOpen ? styles.itemsOpen : ""}`}><div className={styles.section}><div className={styles.sectionItemsOpen}>
            {PUBLIC_SITE_NAV.map((item) => <a key={item.href} href={item.href} target="_blank" rel="noreferrer" onClick={closeMenu}><ExternalLink size={16} /><span>{item.label}</span></a>)}
          </div></div></div>
        </section>
        {platformGroups.map((group) => {
          const hasActiveItem = groupItems(group).some((item) => isAdminNavItemActive(pathname, item.href, item.exact));
          const isOpen = openGroups.includes(group.id);
          return <section key={group.id} className={`${styles.group} ${hasActiveItem ? styles.groupActive : ""}`}>
            <button type="button" className={styles.trigger} onClick={() => toggleGroup(group.id)} aria-expanded={isOpen}><span>{group.label}</span><ChevronDown size={15} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} /></button>
            <div className={`${styles.items} ${isOpen ? styles.itemsOpen : ""}`}>
              {group.sections.map((section, sectionIndex) => {
                const nestedSectionId = sectionId(group.id, section, sectionIndex);
                const hasActiveSectionItem = section.items.some((item) => isAdminNavItemActive(pathname, item.href, item.exact));
                const isSectionOpen = openSections.includes(nestedSectionId);
                return <div key={nestedSectionId} className={styles.section}>
                  {section.label ? <button type="button" className={`${styles.sectionTrigger} ${hasActiveSectionItem ? styles.sectionTriggerActive : ""}`} onClick={() => toggleSection(nestedSectionId)} aria-expanded={isSectionOpen}><span>{section.label}</span><ChevronDown size={14} className={`${styles.chevron} ${isSectionOpen ? styles.chevronOpen : ""}`} /></button> : null}
                  <div className={`${section.label ? styles.sectionItems : ""} ${!section.label || isSectionOpen ? styles.sectionItemsOpen : ""}`}>
                    {section.items.map((item) => { const active = isAdminNavItemActive(pathname, item.href, item.exact); return <Link key={item.href} href={item.href} onClick={closeMenu} aria-current={active ? "page" : undefined}><item.icon size={17} /><span>{item.label}</span>{item.meta ? <small>{item.meta}</small> : null}</Link>; })}
                  </div>
                </div>;
              })}
              {group.id === "client-onboarding" && tenants.length === 0 ? <p className={styles.emptyState}>No client organizations yet.</p> : null}
            </div>
          </section>;
        })}
      </nav>
      <div className={`admin-sidebar-footer ${styles.footer}`}>
        <div className={extras.userCard}><span><Database size={15} /></span><div><strong>Platform Admin</strong><small>{email}</small></div></div>
        <LogoutButton />
      </div>
    </aside>
  </>;
}