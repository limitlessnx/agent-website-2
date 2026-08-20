"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart2, BrainCircuit, Building2, Home, MessageCircle, Settings, Users, Zap } from "lucide-react";
import styles from "@/components/admin/WorkspaceRail.module.css";

type Item = { href: string; label: string; Icon: typeof Activity };

const limitless: Item[] = [
  { href: "/dashboard/limitless", label: "Overview", Icon: Home },
  { href: "/dashboard/organizations", label: "Organizations", Icon: Building2 },
  { href: "/dashboard/limitless/leads", label: "Leads", Icon: Users },
  { href: "/dashboard/limitless/properties", label: "Properties", Icon: Home },
  { href: "/dashboard/limitless/agentic", label: "Maia", Icon: BrainCircuit },
  { href: "/dashboard/limitless/conversations", label: "Conversations", Icon: MessageCircle },
  { href: "/dashboard/workflows", label: "Automations", Icon: Zap },
  { href: "/dashboard/analytics", label: "Analytics", Icon: BarChart2 },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
];

const gencouv: Item[] = [
  { href: "/dashboard/gencouv", label: "Overview", Icon: Home },
  { href: "/dashboard/gencouv#email-control", label: "Email", Icon: MessageCircle },
  { href: "/dashboard/gencouv#gencouv-inbox", label: "Inbox", Icon: MessageCircle },
  { href: "/dashboard/gencouv#lead-board", label: "Leads", Icon: Users },
  { href: "/dashboard/gencouv#sequence-status", label: "Sequences", Icon: Activity },
  { href: "/dashboard/gencouv#acquisition", label: "Acquisition", Icon: BarChart2 },
  { href: "/dashboard/gencouv#operations", label: "Operations", Icon: Zap },
];

const platform: Item[] = [
  { href: "/dashboard", label: "Command", Icon: Home },
  { href: "/dashboard/agents", label: "Agents", Icon: BrainCircuit },
  { href: "/dashboard/activity", label: "Activity", Icon: Activity },
  { href: "/dashboard/knowledge", label: "Knowledge", Icon: Building2 },
  { href: "/dashboard/memory", label: "Memory", Icon: BrainCircuit },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
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

  return <nav className={styles.rail} aria-label={`${name} dashboard navigation`}>
    <div className={styles.identity}><span className={styles.dot}/><strong>{name}</strong></div>
    <div className={styles.items}>
      {items.map(({ href, label, Icon }) => <Link key={href} href={href} className={active(pathname, href) ? styles.active : ""}><Icon size={16}/><span>{label}</span></Link>)}
    </div>
  </nav>;
}
