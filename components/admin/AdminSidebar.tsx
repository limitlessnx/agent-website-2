"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, Bot, BrainCircuit, Building2, ChevronDown, ClipboardList,
  CreditCard, Database, Home, Image, Layers3, LineChart, Megaphone, Menu,
  MessageCircle, Network, PlugZap, Plus, Settings, Users, X, Bell,
  Mail, PhoneCall, Search, ShieldCheck,
} from "lucide-react";
import LogoutButton from "@/components/admin/LogoutButton";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import styles from "@/components/admin/AdminSidebar.module.css";
import extras from "@/components/admin/AdminSidebarExtras.module.css";

const platformGroups = [
  {
    id: "fluxknight-core",
    label: "Fluxknight Platform",
    items: [
      { href: "/dashboard", label: "Command Center", icon: Home, exact: true },
      { href: "/dashboard/notifications", label: "Admin Notifications", icon: Bell },
      { href: "/dashboard/agents", label: "Super Assistant", icon: Bot },
      { href: "/dashboard/activity", label: "Global Activity", icon: Activity },
    ],
  },
  {
    id: "platform-automations",
    label: "Platform Automations",
    items: [
      { href: "/dashboard/automations", label: "Automation Center", icon: Network },
      { href: "/dashboard/workflows", label: "Automation Health", icon: ShieldCheck },
      { href: "/dashboard/workflows/email", label: "Email Automation", icon: Mail },
      { href: "/dashboard/workflows/calls", label: "Outbound Call Agent", icon: PhoneCall },
      { href: "/dashboard/workflows/scraping", label: "Lead Scraping Agent", icon: Search },
    ],
  },
  {
    id: "owned-organizations",
    label: "Admin Organizations",
    items: [
      { href: "/dashboard/organizations", label: "Owned Organizations", icon: Layers3, exact: true },
      { href: "/dashboard/limitless/leads", label: "Limitless Realty", icon: Building2 },
      { href: "/dashboard/gencouv", label: "Gencouv", icon: LineChart },
    ],
  },
  {
    id: "client-organizations",
    label: "Client Organizations",
    items: [
      { href: "/dashboard/clients", label: "Client Registry", icon: Users },
      { href: "/dashboard/onboarding", label: "Client Onboarding", icon: ClipboardList },
    ],
  },
  {
    id: "limitless-tools",
    label: "Limitless Realty Tools",
    items: [
      { href: "/dashboard/limitless/leads", label: "CRM · Leads", icon: Users },
      { href: "/dashboard/limitless/followups", label: "CRM · Follow-ups", icon: MessageCircle },
      { href: "/dashboard/limitless/properties", label: "Property Registry", icon: Building2 },
      { href: "/dashboard/limitless/media", label: "Knowledge & Media", icon: Image },
      { href: "/dashboard/limitless/campaigns", label: "Campaign Center", icon: Megaphone },
      { href: "/dashboard/limitless/payments", label: "Revenue Operations", icon: CreditCard },
    ],
  },
  {
    id: "platform-governance",
    label: "Platform Governance",
    items: [
      { href: "/dashboard/integrations", label: "Integration Center", icon: PlugZap },
      { href: "/dashboard/ai-models", label: "AI Model Control", icon: BrainCircuit },
      { href: "/dashboard/knowledge", label: "Knowledge Center", icon: Database },
      { href: "/dashboard/memory", label: "Memory Center", icon: BrainCircuit },
      { href: "/dashboard/settings", label: "Platform Settings", icon: Settings },
    ],
  },
];

function itemIsActive(pathname: string, item: { href: string; exact?: boolean }) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const activeGroupIds = useMemo(
    () => platformGroups.filter((group) => group.items.some((item) => itemIsActive(pathname, item))).map((group) => group.id),
    [pathname],
  );
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroupIds.length ? activeGroupIds : ["fluxknight-core", "platform-automations"]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!activeGroupIds.length) return;
    setOpenGroups((current) => Array.from(new Set([...current, ...activeGroupIds])));
  }, [activeGroupIds]);

  function toggleGroup(id: string) {
    setOpenGroups((current) => current.includes(id) ? current.filter((groupId) => groupId !== id) : [...current, id]);
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  const workspaceName = pathname.startsWith("/dashboard/gencouv")
    ? "Gencouv"
    : pathname.startsWith("/dashboard/limitless")
      ? "Limitless Realty"
      : pathname.startsWith("/dashboard/clients")
        ? "Client Organizations"
        : "Fluxknight Platform";

  return (
    <>
      {!mobileOpen ? <button type="button" className={styles.mobileToggle} onClick={() => setMobileOpen(true)} aria-label="Open navigation menu"><Menu size={21} /></button> : null}
      {mobileOpen ? <button className={styles.backdrop} type="button" aria-label="Close navigation menu" onClick={closeMobileMenu} /> : null}

      <aside className={`admin-sidebar ${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.mobileHeader}><button type="button" onClick={closeMobileMenu} aria-label="Close navigation menu"><X size={20} /></button></div>
        <Link href="/dashboard" onClick={closeMobileMenu} className={`admin-brand ${styles.brand} ${extras.brandLockup}`}><FluxknightLogo className={extras.wordmark} /><small>AI Operations Platform</small></Link>

        <div className={extras.workspaceSwitcher}>
          <span className={extras.workspaceIcon}><Building2 size={16} /></span>
          <span><small>Current scope</small><strong>{workspaceName}</strong></span>
        </div>

        <nav className={`admin-nav ${styles.nav}`} aria-label="Platform and organization navigation">
          {platformGroups.map((group) => {
            const isOpen = openGroups.includes(group.id);
            const hasActiveItem = group.items.some((item) => itemIsActive(pathname, item));
            return (
              <section key={group.id} className={`${styles.group} ${hasActiveItem ? styles.groupActive : ""}`}>
                <button type="button" className={styles.trigger} onClick={() => toggleGroup(group.id)} aria-expanded={isOpen}>
                  <span>{group.label}</span><ChevronDown size={15} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} />
                </button>
                <div className={`${styles.items} ${isOpen ? styles.itemsOpen : ""}`}>
                  {group.items.map((item) => {
                    const active = itemIsActive(pathname, item);
                    return <Link key={item.href} href={item.href} onClick={closeMobileMenu} aria-current={active ? "page" : undefined}><item.icon size={17} /><span>{item.label}</span></Link>;
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <Link href="/dashboard/clients" onClick={closeMobileMenu} className={extras.addOrganization}><Plus size={15} /> Add client organization</Link>
        <div className={`admin-sidebar-footer ${styles.footer}`}>
          <div className={extras.userCard}><span><Database size={15} /></span><div><strong>Platform Admin</strong><small>{email}</small></div></div>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}