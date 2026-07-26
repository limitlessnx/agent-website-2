import type { SVGProps } from "react";

export default function FluxknightLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 260 48"
      fill="none"
      role="img"
      aria-label="Fluxknight"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
      <text
        x="130"
        y="33"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Inter, Arial, Helvetica, sans-serif"
        fontSize="27"
        fontWeight="500"
        letterSpacing="7.2"
      >
        FLUXKNIGHT
      </text>
    </svg>
  );
}
