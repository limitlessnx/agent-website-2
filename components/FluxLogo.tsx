export default function FluxLogo({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={`flux-wordmark ${compact ? "compact" : ""} ${className}`.trim()}
      aria-label="Fluxknight"
    >
      <span>FLU</span>
      <span className="flux-wordmark-x">X</span>
      <span>KNIGHT</span>
    </span>
  );
}
