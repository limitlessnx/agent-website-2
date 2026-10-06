"use client";

import Link from "next/link";
import { ReactNode } from "react";

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

const styles = {
  primary: {
    base: {
      background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
      color: "#ffffff",
      border: "1px solid rgba(167,139,250,.55)",
      fontWeight: 650,
      boxShadow: "0 8px 24px rgba(124,58,237,.18)",
    },
    hover: {
      background: "linear-gradient(135deg, #9b6cff 0%, #7c3aed 100%)",
      boxShadow: "0 10px 30px rgba(124,58,237,.26)",
      transform: "translateY(-1px)",
    },
  },
  ghost: {
    base: {
      background: "rgba(124,58,237,.08)",
      color: "#d9ccff",
      border: "1px solid rgba(167,139,250,.22)",
      fontWeight: 600,
      boxShadow: "none",
    },
    hover: {
      background: "rgba(124,58,237,.14)",
      borderColor: "rgba(167,139,250,.42)",
      color: "#f8f7ff",
    },
  },
  outline: {
    base: {
      background: "rgba(255,255,255,.015)",
      color: "#e8e4f5",
      border: "1px solid rgba(181,166,232,.22)",
      fontWeight: 600,
      boxShadow: "none",
    },
    hover: {
      background: "rgba(124,58,237,.06)",
      borderColor: "rgba(167,139,250,.38)",
      color: "#f8f7ff",
    },
  },
};

const sizes = {
  sm: { minHeight: "36px", minWidth: "88px", padding: "7px 14px", fontSize: "0.78rem", borderRadius: "9px" },
  md: { minHeight: "40px", minWidth: "112px", padding: "9px 16px", fontSize: "0.84rem", borderRadius: "10px" },
  lg: { minHeight: "44px", minWidth: "132px", padding: "11px 20px", fontSize: "0.92rem", borderRadius: "11px" },
};

const sharedStyle = {
  boxSizing: "border-box" as const,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  textDecoration: "none",
  transition: "background 160ms ease, border-color 160ms ease, box-shadow 180ms ease, transform 140ms ease, opacity 160ms ease",
  whiteSpace: "nowrap" as const,
  position: "relative" as const,
  overflow: "hidden" as const,
  WebkitTapHighlightColor: "transparent",
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
  if (!loading) return <>{children}</>;

  return (
    <>
      <span className="fk-action-spinner" aria-hidden="true" />
      <span>{label}</span>
    </>
  );
}

export default function Button({
  href,
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
  const baseStyle = {
    ...styles[variant].base,
    ...sizes[size],
    ...sharedStyle,
    cursor: isBusy ? "not-allowed" : "pointer",
    width: fullWidth ? "100%" : "auto",
    opacity: disabled && !loading ? 0.48 : 1,
    pointerEvents: isBusy ? ("none" as const) : ("auto" as const),
  };

  const hoverStyle = styles[variant].hover;

  if (href) {
    return (
      <Link
        href={href}
        className={`fk-action-button ${className}`.trim()}
        data-size={size}
        data-variant={variant}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        aria-disabled={isBusy || undefined}
        style={baseStyle}
        onMouseEnter={(e) => {
          if (!isBusy) Object.assign(e.currentTarget.style, hoverStyle);
        }}
        onMouseLeave={(e) => {
          Object.assign(e.currentTarget.style, styles[variant].base);
        }}
      >
        <ActionContent loading={loading} label={label}>{children}</ActionContent>
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
      className={`fk-action-button ${className}`.trim()}
      data-size={size}
      data-variant={variant}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (!isBusy) Object.assign(e.currentTarget.style, hoverStyle);
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, styles[variant].base);
      }}
    >
      <ActionContent loading={loading} label={label}>{children}</ActionContent>
    </button>
  );
}
