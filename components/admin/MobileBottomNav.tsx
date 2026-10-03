"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Home, Menu, MessageSquareText, Plus } from "@/components/admin/ServerIcons";
import { useMobileNavigation } from "@/components/admin/MobileNavigationContext";
import styles from "./MobileBottomNav.module.css";

const items = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquareText },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { open, openMenu } = useMobileNavigation();

  return (
    <nav className={styles.nav} aria-label="Mobile primary navigation">
      <Link href="/dashboard" className={pathname === "/dashboard" ? styles.active : ""} aria-current={pathname === "/dashboard" ? "page" : undefined}>
        <Home size={18} aria-hidden="true" />
        <span>Home</span>
      </Link>
      <Link href="/dashboard/agents" className={pathname.startsWith("/dashboard/agents") ? styles.active : ""}>
        <Bot size={18} aria-hidden="true" />
        <span>Agents</span>
      </Link>
      <button type="button" onClick={openMenu} className={styles.createAction} aria-label="Open Limitless Realty quick actions">
        <Plus size={25} aria-hidden="true" />
      </button>
      <Link href="/dashboard/conversations" className={pathname.startsWith("/dashboard/conversations") ? styles.active : ""}>
        <MessageSquareText size={18} aria-hidden="true" />
        <span>Conversations</span>
      </Link>
      <button type="button" onClick={openMenu} className={open ? styles.active : ""} aria-label="Open full navigation menu" aria-expanded={open} aria-controls="admin-mobile-navigation">
        <Menu size={18} aria-hidden="true" />
        <span>Menu</span>
      </button>
    </nav>
  );
}
