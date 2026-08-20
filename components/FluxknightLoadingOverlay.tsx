"use client";

import FluxknightLogo from "@/components/admin/FluxknightLogo";
import styles from "./FluxknightLoadingOverlay.module.css";

export default function FluxknightLoadingOverlay() {
  return (
    <div className={styles.overlay} role="status" aria-label="Loading">
      <div className={styles.mark}>
        <span className={styles.ring} aria-hidden="true" />
        <div className={styles.logo}>
          <FluxknightLogo />
        </div>
      </div>
    </div>
  );
}
