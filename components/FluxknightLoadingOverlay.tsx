"use client";

import FluxknightLogo from "@/components/admin/FluxknightLogo";
import styles from "./FluxknightLoadingOverlay.module.css";

export default function FluxknightLoadingOverlay({ visible = true }: { visible?: boolean }) {
  return (
    <div
      className={`${styles.overlay} ${visible ? styles.visible : ""}`}
      role={visible ? "status" : undefined}
      aria-label={visible ? "Loading" : undefined}
      aria-hidden={!visible}
    >
      <div className={styles.mark}>
        <span className={styles.ring} aria-hidden="true" />
        <div className={styles.logo}>
          <FluxknightLogo />
        </div>
      </div>
    </div>
  );
}
