import type { SVGProps } from "react";

export default function FluxknightLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 64"
      fill="none"
      role="img"
      aria-label="Fluxknight"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
      <defs>
        <linearGradient id="fluxknight-mark-light" x1="10" y1="8" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D9D2EA" />
        </linearGradient>
        <linearGradient id="fluxknight-mark-violet" x1="34" y1="18" x2="72" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="0.48" stopColor="#A855F7" />
          <stop offset="1" stopColor="#C084FC" />
        </linearGradient>
        <linearGradient id="fluxknight-x" x1="173" y1="20" x2="198" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C084FC" />
          <stop offset="0.52" stopColor="#A855F7" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <filter id="fluxknight-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g aria-hidden="true">
        <path d="M18 45.5L39.5 10H57L35.5 45.5H18Z" fill="url(#fluxknight-mark-light)" />
        <path d="M39 55L60.5 19.5H78L56.5 55H39Z" fill="url(#fluxknight-mark-violet)" filter="url(#fluxknight-glow)" />
      </g>

      <g fontFamily="Inter, Arial, Helvetica, sans-serif" fontSize="27" fontWeight="600" letterSpacing="4.4">
        <text x="91" y="41" fill="currentColor">FLU</text>
        <text x="166" y="41" fill="url(#fluxknight-x)" filter="url(#fluxknight-glow)">X</text>
        <text x="193" y="41" fill="currentColor">KNIGHT</text>
      </g>
    </svg>
  );
}
