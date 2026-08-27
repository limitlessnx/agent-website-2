"use client";

import FluxknightLogo from "@/components/admin/FluxknightLogo";
import styles from "./MobileAdminHeader.module.css";

export default function MobileAdminHeader() {
  return (
    <header className={styles.header} aria-label="Fluxknight mobile header">
      <FluxknightLogo className={styles.logo} />
      <div className={styles.scope}>
        <span>Admin</span>
        <strong>Fluxknight</strong>
      </div>
    </header>
  );
}
