"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart2, BrainCircuit, Home, Megaphone, MessageCircle, Settings, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "@/components/admin/WorkspaceRail.module.css";

type Item = { href: string; label: string; Icon: typeof Activity };

/**
 * Desktop navigation ownership:
 * AdminSidebar owns the complete primary navigation inventory.
 * WorkspaceRail is a contextual quick-access strip only.
 */
const fluxknight: Item[] = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/dashboard/conversations", label: "Conversations", Icon: MessageCircle },
  { href: "/dashboard/activity", label: "Activity", Icon: Activity },
  { href: "/dashboard/workflows", label: "Automations", Icon: Zap },
  { href: "/dashboard/social", label: "Socials", Icon: Megaphone },
];

const limitless: Item[] = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/dashboard/limitless/leads", label: "Leads", Icon: Users },
  { href: "/dashboard/conversations", label: "Conversations", Icon: MessageCircle },
  { href: "/dashboard/activity", label: "Activity", Icon: Activity },
  { href: "/dashboard/limitless/properties", label: "Properties", Icon: Home },
  { href: "/dashboard/limitless/agentic", label: "Agentic", Icon: BrainCircuit },
  { href: "/dashboard/workflows", label: "Automations", Icon: Zap },
  { href: "/dashboard/limitless/payments", label: "Payments", Icon: Activity },
];

const gencouv: Item[] = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/dashboard/gencouv", label: "Operations", Icon: Home },
  { href: "/dashboard/gencouv#email-control", label: "Email", Icon: MessageCircle },
  { href: "/dashboard/gencouv#gencouv-inbox", label: "Inbox", Icon: MessageCircle },
  { href: "/dashboard/gencouv#lead-board", label: "Leads", Icon: Users },
  { href: "/dashboard/conversations", label: "Conversations", Icon: MessageCircle },
  { href: "/dashboard/activity", label: "Activity", Icon: Activity },
  { href: "/dashboard/workflows", label: "Automations", Icon: Zap },
  { href: "/dashboard/gencouv#sequence-status", label: "Sequences", Icon: Activity },
  { href: "/dashboard/gencouv#acquisition", label: "Acquisition", Icon: BarChart2 },
  { href: "/dashboard/gencouv#operations", label: "Operations", Icon: Zap },
];

function tenantItems(organizationId: string): Item[] {
  return [
    { href: "/dashboard", label: "Home", Icon: Home },
    { href: "/dashboard/crm", label: "Leads", Icon: Users },
    { href: "/dashboard/conversations", label: "Conversations", Icon: MessageCircle },
    { href: "/dashboard/activity", label: "Activity", Icon: Activity },
    { href: "/dashboard/workflows", label: "Automations", Icon: Zap },
    { href: "/dashboard/agents", label: "Agents", Icon: BrainCircuit },
    { href: "/dashboard/tenant/analytics", label: "Analytics", Icon: BarChart2 },
    { href: `/dashboard/clients/${encodeURIComponent(organizationId)}/setup`, label: "Settings", Icon: Settings },
  ];
}

function active(pathname: string, href: string) {
  const route = href.split("#")[0];
  if (route === "/dashboard/gencouv") return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}

type ActiveOrganization = { kind: "system" | "tenant"; id: string; name: string };

export default function WorkspaceRail({ activeOrganization }: { activeOrganization: ActiveOrganization }) {
  const pathname = usePathname();
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px)");
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (!desktop) return null;

  const name = activeOrganization.name;
  const isLimitless = activeOrganization.kind === "system" && activeOrganization.id === "limitless-realty";
  const isGencouv = activeOrganization.kind === "system" && activeOrganization.id === "gencouv";
  const isFluxknight = activeOrganization.kind === "system" && activeOrganization.id === "fluxknight";
  const items = activeOrganization.kind === "tenant"
    ? tenantItems(activeOrganization.id)
    : isLimitless
      ? limitless
      : isGencouv
        ? gencouv
        : isFluxknight
          ? fluxknight
          : tenant;

  return (
    <nav className={`${styles.rail} workspace-rail`} aria-label={`${name} quick navigation`}>
      <div className={styles.identity} aria-hidden="true"><span className={styles.dot} /><strong>{name}</strong></div>
      <div className={styles.items}>
        {items.map(({ href, label, Icon }) => {
          const isActive = active(pathname, href);
          return <Link key={href} href={href} className={isActive ? styles.active : ""} aria-current={isActive ? "page" : undefined}>
            <Icon size={16} />
            <span>{label}</span>
          </Link>;
        })}
      </div>
    </nav>
  );
}
