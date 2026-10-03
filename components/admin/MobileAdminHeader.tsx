"use client";

import Link from "next/link";
import { Bell, Menu } from "@/components/admin/ServerIcons";
import { useMobileNavigation } from "@/components/admin/MobileNavigationContext";
import styles from "./MobileAdminHeader.module.css";

export default function MobileAdminHeader() {
  const { open, openMenu } = useMobileNavigation();

  return (
    <header className={styles.header} aria-label="Limitless Realty mobile header">
      <div className={styles.brandGroup}>
        <button type="button" className={styles.menuButton} onClick={openMenu} aria-label="Open navigation menu" aria-expanded={open} aria-controls="admin-mobile-navigation">
          <Menu size={22} aria-hidden="true" />
        </button>
        <Link href="/dashboard" className={styles.logo} aria-label="Limitless Realty home">
          <span className={styles.logoMark}>L</span>
          <span>LIMITLESS <b>REALTY</b></span>
        </Link>
      </div>
      <div className={styles.actions}>
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
