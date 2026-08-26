"use client";

import FluxknightLogo from "@/components/admin/FluxknightLogo";
import { Menu } from "@/components/admin/ServerIcons";
import styles from "./MobileAdminHeader.module.css";

export default function MobileAdminHeader() {
  function openNavigation() {
    window.dispatchEvent(new CustomEvent("fluxknight:mobile-menu"));
  }

  return (
    <header className={styles.header} aria-label="Fluxknight mobile header">
      <button type="button" className={styles.menu} onClick={openNavigation} aria-label="Open navigation menu">
        <Menu size={20} />
      </button>
      <FluxknightLogo className={styles.logo} />
      <div className={styles.scope}>
        <span>Admin</span>
        <strong>Fluxknight</strong>
      </div>
    </header>
  );
}
