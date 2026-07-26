"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Boxes,
  BrainCircuit,
  Building2,
  ChevronDown,
  CreditCard,
  Database,
  Home,
  Image,
  Layers3,
  Megaphone,
  Menu,
  MessageCircle,
  Network,
  PlugZap,
  Plus,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react";
import LogoutButton from "@/components/admin/LogoutButton";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import styles from "@/components/admin/AdminSidebar.module.css";
import extras from "@/components/admin/AdminSidebarExtras.module.css";

const platformGroups = [
  {
    id: "platform",
    label: "Platform",
    items: [
      { href: "/dashboard", label: "Executive Overview", icon: Home, exact: true },
      { href: "/dashboard/clients", label: "Organizations", icon: Layers3 },
      { href: "/dashboard/platform-engine", label: "Platform Engine", icon: Boxes },
      { href: "/dashboard/integrations", label: "Integration Center", icon: PlugZap },
      { href: "/dashboard/knowledge", label: "Knowledge Center", icon: Database },
      { href: "/dashboard/memory", label: "Memory Center", icon: BrainCircuit },
    ],
  },
  {
    id: "workspace-limitless",
    label: "Limitless Realty Workspace",
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
    id: "ai-operations",
    label: "AI Operations",
    items: [
      { href: "/dashboard/agents", label: "Agent Registry", icon: Bot },
      { href: "/dashboard/workflows", label: "Workflow Registry", icon: Workflow },
      { href: "/dashboard/automations", label: "Automation Control", icon: Network },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      { href: "/dashboard/activity", label: "Unified Activity", icon: Activity },
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
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroupIds.length ? activeGroupIds : ["platform", "workspace-limitless"]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  function toggleGroup(id: string) {
    setOpenGroups((current) => current.includes(id) ? current.filter((groupId) => groupId !== id) : [...current, id]);
  }

  return (
    <>
      {!mobileOpen ? (
        <button type="button" className={styles.mobileToggle} onClick={() => setMobileOpen(true)} aria-label="Open navigation menu">
          <Menu size={21} />
        </button>
      ) : null}
      {mobileOpen ? <button className={styles.backdrop} type="button" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`admin-sidebar ${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.mobileHeader}>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu"><X size={20} /></button>
        </div>

        <Link href="/dashboard" className={`admin-brand ${styles.brand} ${extras.brandLockup}`}>
          <FluxknightLogo className={extras.wordmark} />
          <small>AI Operations Platform</small>
        </Link>

        <button type="button" className={extras.workspaceSwitcher}>
          <span className={extras.workspaceIcon}><Building2 size={16} /></span>
          <span><small>Organization workspace</small><strong>Limitless Realty</strong></span>
          <ChevronDown size={15} />
        </button>

        <nav className={`admin-nav ${styles.nav}`} aria-label="Organization workspace navigation">
          {platformGroups.map((group) => {
            const isOpen = openGroups.includes(group.id);
            const hasActiveItem = group.items.some((item) => itemIsActive(pathname, item));
            return (
              <section key={group.id} className={`${styles.group} ${hasActiveItem ? styles.groupActive : ""}`}>
                <button type="button" className={styles.trigger} onClick={() => toggleGroup(group.id)} aria-expanded={isOpen}>
                  <span>{group.label}</span>
                  <ChevronDown size={15} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} />
                </button>
                <div className={`${styles.items} ${isOpen ? styles.itemsOpen : ""}`}>
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

        <Link href="/dashboard/clients" className={extras.addOrganization}><Plus size={15} /> Add organization</Link>

        <div className={`admin-sidebar-footer ${styles.footer}`}>
          <div className={extras.userCard}>
            <span><Database size={15} /></span>
            <div><strong>Platform Admin</strong><small>{email}</small></div>
          </div>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
