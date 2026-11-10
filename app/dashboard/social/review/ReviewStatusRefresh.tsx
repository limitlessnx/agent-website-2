"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./review.module.css";

export function ReviewStatusRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button type="button" className={`${styles.actionButton} ${styles.secondary}`} disabled={pending}
      aria-busy={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? <span className={styles.loadingSpinner} aria-hidden="true" /> : null}
      {pending ? "Checking status…" : "Check render status"}
    </button>
  );
}
