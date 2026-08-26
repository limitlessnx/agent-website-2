"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, Building2, Home, MoreHorizontal } from "@/components/admin/ServerIcons";
import styles from "./MobileBottomNav.module.css";

const items = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/clients", label: "Workspaces", icon: Building2 },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
  { href: "/dashboard/settings", label: "More", icon: MoreHorizontal },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Mobile navigation">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} className={active ? styles.active : ""} aria-current={active ? "page" : undefined}>
          <item.icon size={18} /><span>{item.label}</span>
        </Link>;
      })}
    </nav>
  );
}
