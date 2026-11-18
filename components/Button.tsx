"use client";

import Link from "next/link";
import { ReactNode } from "react";
import buttonStyles from "./Button.module.css";

export type ButtonAction =
  | "saving"
  | "creating"
  | "updating"
  | "deleting"
  | "sending"
  | "recording"
  | "approving"
  | "rejecting"
  | "uploading"
  | "connecting"
  | "testing"
  | "running";

interface ButtonProps {
  href?: string;
  prefetch?: boolean;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  action?: ButtonAction;
  loadingLabel?: string;
  ariaLabel?: string;
  className?: string;
}

const actionLabels: Record<ButtonAction, string> = {
  saving: "Saving…",
  creating: "Creating…",
  updating: "Updating…",
  deleting: "Deleting…",
  sending: "Sending…",
  recording: "Recording…",
  approving: "Approving…",
  rejecting: "Rejecting…",
  uploading: "Uploading…",
  connecting: "Connecting…",
  testing: "Testing…",
  running: "Running…",
};

function ActionContent({
  loading,
  label,
  children,
}: {
  loading: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <span className={buttonStyles.content}>
      <span data-hidden={loading} aria-hidden={loading || undefined}>
        {children}
      </span>
      <span data-hidden={!loading} aria-hidden={!loading || undefined}>
        <span
          className="fk-action-spinner"
          aria-hidden="true"
          style={loading ? undefined : { animation: "none" }}
        />
        {label}
      </span>
    </span>
  );
}

export default function Button({
  href,
  prefetch,
  onClick,
  variant = "primary",
  size = "md",
  children,
  fullWidth = false,
  type = "button",
  disabled = false,
  loading = false,
  action,
  loadingLabel,
  ariaLabel,
  className = "",
}: ButtonProps) {
  const isBusy = loading || disabled;
  const label = loadingLabel || (action ? actionLabels[action] : "Processing…");
  if (href) {
    return (
      <Link
        href={href}
        prefetch={prefetch}
        className={`fk-action-button ${buttonStyles.button} ${className}`.trim()}
        data-size={size}
        data-variant={variant}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        aria-disabled={isBusy || undefined}
        tabIndex={isBusy ? -1 : undefined}
        data-full-width={fullWidth || undefined}
        onClick={(e) => {
          if (isBusy) e.preventDefault();
        }}
      >
        <ActionContent loading={loading} label={label}>
          {children}
        </ActionContent>
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={`fk-action-button ${buttonStyles.button} ${className}`.trim()}
      data-size={size}
      data-variant={variant}
      data-full-width={fullWidth || undefined}
    >
      <ActionContent loading={loading} label={label}>
        {children}
      </ActionContent>
    </button>
  );
}
