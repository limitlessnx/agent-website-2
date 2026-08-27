"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, Building2, Home, Menu } from "@/components/admin/ServerIcons";
import { useMobileNavigation } from "@/components/admin/MobileNavigationContext";
import styles from "./MobileBottomNav.module.css";

const items = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/clients", label: "Workspaces", icon: Building2 },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { open, openMenu } = useMobileNavigation();

  return (
    <nav className={styles.nav} aria-label="Mobile primary navigation">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.label} href={item.href} className={active ? styles.active : ""} aria-current={active ? "page" : undefined}>
            <item.icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={openMenu}
        className={open ? styles.active : ""}
        aria-label="Open full navigation menu"
        aria-expanded={open}
        aria-controls="admin-mobile-navigation"
      >
        <Menu size={18} aria-hidden="true" />
        <span>Menu</span>
      </button>
    </nav>
  );
}
