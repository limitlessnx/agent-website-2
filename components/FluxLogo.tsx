import Image from "next/image";

export default function FluxLogo({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={`flux-wordmark flux-wordmark-image ${compact ? "compact" : ""} ${className}`.trim()}
      aria-label="Fluxknight"
    >
      <Image
        src="/brand/fluxknight-wordmark.webp"
        alt="Fluxknight"
        width={560}
        height={132}
        sizes={compact ? "120px" : "170px"}
        priority
      />
    </span>
  );
}
