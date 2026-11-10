"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import styles from "./review.module.css";

type Props = {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  kind?: "primary" | "secondary" | "danger";
};

export function ReviewSubmitButton({
  children, pendingLabel = "Processing…", className = "", disabled = false, kind = "secondary",
}: Props) {
  const { pending } = useFormStatus();
  const unavailable = pending || disabled;
  return (
    <button
      type="submit"
      className={`${styles.actionButton} ${styles[kind]} ${className}`}
      disabled={unavailable}
      aria-busy={pending}
      data-pending={pending ? "true" : "false"}
    >
      {pending ? <span className={styles.loadingSpinner} aria-hidden="true" /> : null}
      <span aria-live="polite">{pending ? pendingLabel : children}</span>
    </button>
  );
}
