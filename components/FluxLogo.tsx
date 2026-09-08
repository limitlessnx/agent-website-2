import FluxknightLogo from "@/components/admin/FluxknightLogo";

export default function FluxLogo({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={`flux-wordmark ${compact ? "compact" : ""} ${className}`.trim()}
      aria-label="Fluxknight"
      style={{ display: "inline-flex", alignItems: "center", width: compact ? 136 : 176, maxWidth: "100%", lineHeight: 0 }}
    >
      <FluxknightLogo style={{ display: "block", width: "100%", height: "auto", color: "currentColor" }} />
    </span>
  );
}
