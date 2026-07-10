"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface ButtonProps {
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  ariaLabel?: string;
}

const styles = {
  primary: {
    base: {
      background: "#00d4ff",
      color: "#06080f",
      border: "1px solid #00d4ff",
      fontWeight: 700,
      boxShadow: "0 0 20px rgba(0,212,255,0.2)",
    },
    hover: {
      boxShadow: "0 0 35px rgba(0,212,255,0.4)",
      opacity: "0.92",
    },
  },
  ghost: {
    base: {
      background: "rgba(0,212,255,0.08)",
      color: "#00d4ff",
      border: "1px solid rgba(0,212,255,0.25)",
      fontWeight: 600,
    },
    hover: {
      background: "rgba(0,212,255,0.15)",
      borderColor: "rgba(0,212,255,0.5)",
    },
  },
  outline: {
    base: {
      background: "transparent",
      color: "#f0f6ff",
      border: "1px solid #1e2d3d",
      fontWeight: 600,
    },
    hover: {
      borderColor: "rgba(0,212,255,0.4)",
      color: "#00d4ff",
    },
  },
};

const sizes = {
  sm: { padding: "8px 16px", fontSize: "0.8rem", borderRadius: "7px" },
  md: { padding: "11px 24px", fontSize: "0.875rem", borderRadius: "8px" },
  lg: { padding: "14px 32px", fontSize: "1rem", borderRadius: "10px" },
};

export default function Button({
  href,
  onClick,
  variant = "primary",
  size = "md",
  children,
  fullWidth = false,
  type = "button",
  disabled = false,
  ariaLabel,
}: ButtonProps) {
  const baseStyle = {
    ...styles[variant].base,
    ...sizes[size],
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
    transition: "all 0.2s",
    width: fullWidth ? "100%" : "auto",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap" as const,
  };

  const hoverStyle = styles[variant].hover;

  if (href) {
    return (
      <Link
        href={href}
        style={baseStyle}
        aria-label={ariaLabel}
        onMouseEnter={(e) =>
          Object.assign((e.currentTarget as HTMLElement).style, hoverStyle)
        }
        onMouseLeave={(e) =>
          Object.assign(
            (e.currentTarget as HTMLElement).style,
            styles[variant].base
          )
        }
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={baseStyle}
      onMouseEnter={(e) =>
        !disabled &&
        Object.assign((e.currentTarget as HTMLElement).style, hoverStyle)
      }
      onMouseLeave={(e) =>
        Object.assign(
          (e.currentTarget as HTMLElement).style,
          styles[variant].base
        )
      }
    >
      {children}
    </button>
  );
}
