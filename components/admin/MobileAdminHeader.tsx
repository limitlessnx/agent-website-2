"use client";

import Link from "next/link";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import { Bell } from "@/components/admin/ServerIcons";
import styles from "./MobileAdminHeader.module.css";

export default function MobileAdminHeader() {
  return (
    <header className={styles.header} aria-label="Fluxknight mobile header">
      <FluxknightLogo className={styles.logo} />
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
