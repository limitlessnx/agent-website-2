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
import styles from "@/components/admin/AdminSidebar.module.css";
import extras from "@/components/admin/AdminSidebarExtras.module.css";

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number }>; exact?: boolean; meta?: string };
type NavSection = { label?: string; items: NavItem[] };
type NavGroup = { id: string; label: string; sections: NavSection[] };
export type TenantNavItem = { id: string; organizationId: string; name: string; status: string };

const basePlatformGroups: NavGroup[] = [
  { id: "fluxknight-core", label: "Fluxknight Platform", sections: [{ items: [
    { href: "/dashboard", label: "Command Center", icon: Home, exact: true },
    { href: "/dashboard/support", label: "Agent Leo AI Support", icon: LifeBuoy },
    { href: "/dashboard/notifications", label: "Admin Notifications", icon: Bell },
    { href: "/dashboard/evaluations", label: "Evaluation Leads", icon: ClipboardList },
    { href: "/dashboard/agents", label: "Super Assistant", icon: Bot },
    { href: "/dashboard/activity", label: "Global Activity", icon: Activity },
  ] }] },
  { id: "home-agents", label: "Home Agents", sections: [
    { label: "Limitless Realty", items: [
      { href: "/dashboard/limitless/leads", label: "Leads", icon: Users },
      { href: "/dashboard/limitless/daily-briefs", label: "Daily Briefs", icon: ClipboardList },
      { href: "/dashboard/limitless/followups", label: "Follow-ups", icon: MessageCircle },
      { href: "/dashboard/limitless/properties", label: "Properties", icon: Building2 },
      { href: "/dashboard/limitless/media", label: "Knowledge & Media", icon: Image },
      { href: "/dashboard/limitless/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/dashboard/limitless/agentic", label: "Agentic Systems", icon: BrainCircuit },
      { href: "/dashboard/workflows", label: "Workflows", icon: Activity },
      { href: "/dashboard/limitless/payments", label: "Payments", icon: CreditCard },
    ] },
    { label: "Gencouv", items: [
      { href: "/dashboard/gencouv", label: "Overview", icon: LineChart, exact: true },
      { href: "/dashboard/gencouv#email-control", label: "Email Control", icon: Mail },
      { href: "/dashboard/gencouv#gencouv-inbox", label: "Inbox", icon: MessageCircle },
      { href: "/dashboard/gencouv#lead-board", label: "Lead Board", icon: Users },
      { href: "/dashboard/gencouv#sequence-status", label: "Sequence Status", icon: ShieldCheck },
      { href: "/dashboard/gencouv#acquisition", label: "Acquisition", icon: Search },
      { href: "/dashboard/gencouv#operations", label: "Operations", icon: Activity },
    ] },
  ] },
  { id: "platform-governance", label: "Platform Governance", sections: [{ items: [
    { href: "/dashboard/ai-models", label: "AI Model Control", icon: BrainCircuit },
    { href: "/dashboard/knowledge", label: "Knowledge Center", icon: Database },
    { href: "/dashboard/memory", label: "Memory Center", icon: BrainCircuit },
    { href: "/dashboard/settings", label: "Platform Settings", icon: Settings },
  ] }] },
];

const publicSiteLinks = [
  { href: "/", label: "Homepage" }, { href: "/services", label: "Services" }, { href: "/pricing", label: "Pricing" },
  { href: "/industries", label: "Industries" }, { href: "/evaluation", label: "Evaluation" },
];

function groupItems(group: NavGroup) { return group.sections.flatMap((section) => section.items); }
function itemIsActive(pathname: string, item: { href: string; exact?: boolean }) {
  const route = item.href.split("#")[0].split("?")[0];
  return item.exact ? pathname === route : pathname === route || pathname.startsWith(`${route}/`);
}
function tenantLabel(value: string) { return value.replaceAll("_", " "); }
function sectionId(groupId: string, section: NavSection, sectionIndex: number) {
  return section.label ? `${groupId}:${section.label.toLowerCase().replaceAll(" ", "-")}` : `${groupId}:${sectionIndex}`;
}

export default function AdminSidebar({ email, tenants }: { email: string; tenants: TenantNavItem[] }) {
  const pathname = usePathname();
  const platformGroups = useMemo<NavGroup[]>(() => [...basePlatformGroups, {
    id: "client-onboarding", label: "Client Onboarding", sections: [
      { label: "Onboarding", items: [
        { href: "/dashboard/onboarding#new-client", label: "New Client", icon: Plus },
        { href: "/dashboard/onboarding#queue", label: "Onboarding Queue", icon: ClipboardList },
        { href: "/dashboard/clients", label: "Client Registry", icon: Users, exact: true },
      ] },
      { label: "Client Workspaces", items: tenants.map((tenant) => ({
        href: `/dashboard/clients?organizationId=${encodeURIComponent(tenant.organizationId)}`,
        label: tenant.name, icon: Building2, meta: tenantLabel(tenant.status),
      })) },
    ],
  }], [tenants]);

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
            {publicSiteLinks.map((item) => <a key={item.href} href={item.href} target="_blank" rel="noreferrer" onClick={closeMenu}><ExternalLink size={16} /><span>{item.label}</span></a>)}
          </div></div></div>
        </section>
        {platformGroups.map((group) => {
          const hasActiveItem = groupItems(group).some((item) => itemIsActive(pathname, item));
          const isOpen = openGroups.includes(group.id);
          return <section key={group.id} className={`${styles.group} ${hasActiveItem ? styles.groupActive : ""}`}>
            <button type="button" className={styles.trigger} onClick={() => toggleGroup(group.id)} aria-expanded={isOpen}><span>{group.label}</span><ChevronDown size={15} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} /></button>
            <div className={`${styles.items} ${isOpen ? styles.itemsOpen : ""}`}>
              {group.sections.map((section, sectionIndex) => {
                const nestedSectionId = sectionId(group.id, section, sectionIndex);
                const hasActiveSectionItem = section.items.some((item) => itemIsActive(pathname, item));
                const isSectionOpen = openSections.includes(nestedSectionId);
                return <div key={nestedSectionId} className={styles.section}>
                  {section.label ? <button type="button" className={`${styles.sectionTrigger} ${hasActiveSectionItem ? styles.sectionTriggerActive : ""}`} onClick={() => toggleSection(nestedSectionId)} aria-expanded={isSectionOpen}><span>{section.label}</span><ChevronDown size={14} className={`${styles.chevron} ${isSectionOpen ? styles.chevronOpen : ""}`} /></button> : null}
                  <div className={`${section.label ? styles.sectionItems : ""} ${!section.label || isSectionOpen ? styles.sectionItemsOpen : ""}`}>
                    {section.items.map((item) => { const active = itemIsActive(pathname, item); return <Link key={item.href} href={item.href} onClick={closeMenu} aria-current={active ? "page" : undefined}><item.icon size={17} /><span>{item.label}</span>{item.meta ? <small>{item.meta}</small> : null}</Link>; })}
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
