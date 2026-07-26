import type { SVGProps } from "react";

export default function FluxknightLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="fluxknight-mark" x1="8" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B58CFF" />
          <stop offset="0.52" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <path d="M9 13.5 25 8l7 8 7-8 16 5.5-6.5 15L54 48 39 57l-7-7-7 7-15-9 5.5-19.5L9 13.5Z" fill="url(#fluxknight-mark)" />
      <path d="m17 18 11 5-8 6-3-11Zm30 0-11 5 8 6 3-11Z" fill="#080914" opacity=".92" />
      <path d="m22 32 10-8 10 8-4 12-6 5-6-5-4-12Z" fill="#0B1020" />
      <path d="m26 34 6 3 6-3-2 7-4 3-4-3-2-7Z" fill="#E9E4FF" />
      <path d="M17 48 9 42l8-1v7Zm30 0 8-6-8-1v7Z" fill="#22D3EE" opacity=".78" />
    </svg>
  );
}
