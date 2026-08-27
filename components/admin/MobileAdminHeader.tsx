"use client";

import FluxknightLogo from "@/components/admin/FluxknightLogo";
import { Menu } from "@/components/admin/ServerIcons";
import { useMobileNavigation } from "@/components/admin/MobileNavigationContext";
import styles from "./MobileAdminHeader.module.css";

export default function MobileAdminHeader() {
  const { openMenu } = useMobileNavigation();

  return (
    <header className={styles.header} aria-label="Fluxknight mobile header">
      <button type="button" className={styles.menu} onClick={openMenu} aria-label="Open navigation menu">
        <Menu size={20} aria-hidden="true" />
      </button>
      <FluxknightLogo className={styles.logo} />
      <div className={styles.scope}>
        <span>Admin</span>
        <strong>Fluxknight</strong>
      </div>
    </header>
  );
}
