import type { SVGProps } from "react";

export default function FluxknightMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 72 64" fill="none" role="img" aria-label="Fluxknight" {...props}>
      <defs>
        <linearGradient id="fk-mark-light" x1="6" y1="8" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D9D2EA" />
        </linearGradient>
        <linearGradient id="fk-mark-violet" x1="30" y1="18" x2="68" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset=".48" stopColor="#A855F7" />
          <stop offset="1" stopColor="#C084FC" />
        </linearGradient>
      </defs>
      <path d="M8 45.5L29.5 10H47L25.5 45.5H8Z" fill="url(#fk-mark-light)" />
      <path d="M29 55L50.5 19.5H68L46.5 55H29Z" fill="url(#fk-mark-violet)" />
    </svg>
  );
}
