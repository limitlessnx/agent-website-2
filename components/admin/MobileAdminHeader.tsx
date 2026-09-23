"use client";

import Link from "next/link";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import { Bell } from "@/components/admin/ServerIcons";
import ThemeToggle from "@/components/admin/ThemeToggle";
import styles from "./MobileAdminHeader.module.css";

export default function MobileAdminHeader() {
  return (
    <header className={styles.header} aria-label="Fluxknight mobile header">
      <FluxknightLogo className={styles.logo} />
      <div className={styles.actions}>
        <div className={styles.themeControl} aria-label="Dashboard color mode">
          <ThemeToggle />
        </div>
        <Link href="/dashboard/notifications" className={styles.iconButton} aria-label="Open notifications">
          <Bell size={18} />
        </Link>
        <Link href="/dashboard/settings" className={styles.avatar} aria-label="Open account settings">
          <span>L</span>
        </Link>
      </div>
    </header>
  );
}
