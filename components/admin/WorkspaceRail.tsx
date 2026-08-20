"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/components/admin/WorkspaceRail.module.css";

type Item = { href: string; label: string };

const limitless: Item[] = [
  { href: "/dashboard/limitless/agentic", label: "Maia" },
  { href: "/dashboard/limitless/leads", label: "Leads" },
  { href: "/dashboard/limitless/properties", label: "Properties" },
  { href: "/dashboard/limitless/followups", label: "Follow-ups" },
  { href: "/dashboard/workflows", label: "Workflows" },
  { href: "/dashboard/limitless/payments", label: "Payments" },
  { href: "/dashboard/limitless/campaigns", label: "Campaigns" },
  { href: "/dashboard/limitless/media", label: "Knowledge" },
];

const gencouv: Item[] = [
  { href: "/dashboard/gencouv", label: "Overview" },
  { href: "/dashboard/gencouv#email-control", label: "Email" },
  { href: "/dashboard/gencouv#gencouv-inbox", label: "Inbox" },
  { href: "/dashboard/gencouv#lead-board", label: "Leads" },
  { href: "/dashboard/gencouv#sequence-status", label: "Sequences" },
  { href: "/dashboard/gencouv#acquisition", label: "Acquisition" },
  { href: "/dashboard/gencouv#operations", label: "Operations" },
];

const platform: Item[] = [
  { href: "/dashboard", label: "Command" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/activity", label: "Activity" },
  { href: "/dashboard/knowledge", label: "Knowledge" },
  { href: "/dashboard/memory", label: "Memory" },
  { href: "/dashboard/settings", label: "Settings" },
];

function active(pathname: string, href: string) {
  const route = href.split("#")[0];
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default function WorkspaceRail() {
  const pathname = usePathname();
  const isLimitless = pathname.startsWith("/dashboard/limitless");
  const isGencouv = pathname.startsWith("/dashboard/gencouv");
  const name = isLimitless ? "Limitless Realty" : isGencouv ? "Gencouv" : "Fluxknight";
  const items = isLimitless ? limitless : isGencouv ? gencouv : platform;

  return (
    <nav className={styles.rail} aria-label={`${name} quick navigation`}>
      <div className={styles.identity}><span className={styles.dot} /> <strong>{name}</strong><small>Workspace</small></div>
      <div className={styles.items}>
        {items.map((item) => <Link key={item.href} href={item.href} className={active(pathname, item.href) ? styles.active : ""}>{item.label}</Link>)}
      </div>
    </nav>
  );
}
