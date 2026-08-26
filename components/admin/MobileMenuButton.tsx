"use client";

import { Menu } from "@/components/admin/ServerIcons";
import styles from "./MobileDashboardChrome.module.css";

export default function MobileMenuButton() {
  return (
    <button
      type="button"
      className={styles.mobileMenuButton}
      aria-label="Open navigation menu"
      onClick={() => window.dispatchEvent(new CustomEvent("fluxknight:mobile-menu"))}
    >
      <Menu size={20} />
    </button>
  );
}
