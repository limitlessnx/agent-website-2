import Image from "next/image";

type FluxknightLogoProps = {
  className?: string;
  compact?: boolean;
  priority?: boolean;
};

export default function FluxknightLogo({
  className,
  compact = false,
  priority = false,
}: FluxknightLogoProps) {
  return (
    <Image
      className={className}
      src={compact ? "/brand/fluxknight-mark.webp" : "/brand/fluxknight-wordmark.webp"}
      alt="Fluxknight"
      width={compact ? 512 : 560}
      height={compact ? 512 : 132}
      sizes={compact ? "96px" : "190px"}
      priority={priority}
    />
  );
}
