"use client";

import React from "react";

type LeoRobotProps = {
  size?: number | string;
  className?: string;
  label?: string;
};

/** Fluxknight Leo robot artwork, rendered as reusable inline SVG. */
export default function LeoRobot({
  size = 320,
  className,
  label = "Leo, the Fluxknight AI assistant",
}: LeoRobotProps) {
  return (
    <svg className={className} width={size} height={typeof size === "number" ? size * 1.12 : "auto"} viewBox="0 0 360 404" role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leoShell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff"/><stop offset=".48" stopColor="#e8e5f1"/><stop offset="1" stopColor="#aaa6c0"/></linearGradient>
        <linearGradient id="leoDark" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stopColor="#292536"/><stop offset=".55" stopColor="#090811"/><stop offset="1" stopColor="#393046"/></linearGradient>
        <linearGradient id="leoPurple" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e0a1ff"/><stop offset=".55" stopColor="#b34dff"/><stop offset="1" stopColor="#7927e8"/></linearGradient>
        <filter id="leoGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="leoShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#03020a" floodOpacity=".4"/></filter>
      </defs>
      <path d="M112 86 C117 24 244 14 275 81" fill="none" stroke="#b8b1cb" strokeWidth="8" strokeLinecap="round"/>
      <path d="M119 81 C136 37 232 28 264 78" fill="none" stroke="#f8f5ff" strokeWidth="4" strokeLinecap="round"/>
      <path d="M181 28V13" stroke="#b84fff" strokeWidth="4" strokeLinecap="round" filter="url(#leoGlow)"/><circle cx="181" cy="10" r="5" fill="#c56aff" filter="url(#leoGlow)"/>
      <path d="M81 111C73 48 119 30 177 30S282 51 280 111" fill="none" stroke="#15131f" strokeWidth="18"/>
      <path d="M82 111C75 53 123 36 177 36S276 55 279 111" fill="none" stroke="#c8c1d8" strokeWidth="7"/>
      <g filter="url(#leoShadow)"><rect x="62" y="91" width="35" height="83" rx="15" fill="url(#leoDark)" stroke="#a64aff" strokeWidth="3"/><rect x="69" y="103" width="20" height="57" rx="10" fill="url(#leoPurple)" opacity=".9"/><rect x="267" y="91" width="35" height="83" rx="15" fill="url(#leoDark)" stroke="#a64aff" strokeWidth="3"/><rect x="274" y="103" width="20" height="57" rx="10" fill="url(#leoPurple)" opacity=".9"/></g>
      <g filter="url(#leoShadow)"><rect x="78" y="48" width="210" height="174" rx="55" fill="url(#leoShell)" stroke="#f7f2ff" strokeWidth="3"/><rect x="91" y="61" width="184" height="148" rx="43" fill="url(#leoDark)" stroke="#655b78" strokeWidth="3"/><path d="M108 78Q146 60 182 66M232 74l18 16" stroke="#fff" strokeOpacity=".34" strokeWidth="4" fill="none" strokeLinecap="round"/><path d="M125 128Q145 102 164 128M201 128Q221 102 241 128" fill="none" stroke="url(#leoPurple)" strokeWidth="12" strokeLinecap="round" filter="url(#leoGlow)"/><path d="M165 151Q183 171 202 151" fill="none" stroke="#d47aff" strokeWidth="9" strokeLinecap="round" filter="url(#leoGlow)"/></g>
      <path d="M145 213v28q36 19 73-1v-27" fill="url(#leoDark)" stroke="#a7a0b9" strokeWidth="5"/><path d="M159 226v17m45-17v17" stroke="#b94eff" strokeWidth="4" strokeLinecap="round"/>
      <g filter="url(#leoShadow)"><path d="M104 242q76-26 151 2l30 82q1 22-22 26H99q-23-5-18-26z" fill="url(#leoShell)" stroke="#f9f6ff" strokeWidth="3"/><path d="M112 253q68-20 134 0l15 65q0 13-14 15H111q-13-2-12-15z" fill="#171420" stroke="#827891" strokeWidth="3"/><rect x="143" y="264" width="74" height="56" rx="13" fill="#100d1b" stroke="#8b42dd" strokeWidth="2"/><g transform="translate(180 292)" stroke="url(#leoPurple)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="m-18-13 32 27M17-17-12 13M-7-17-17-7-6-6M7 17l10-10-11-1"/></g><path d="m102 271-14 41m170-41 14 41" stroke="#b54cff" strokeWidth="5" strokeLinecap="round"/></g>
      <path d="M105 258c-26 4-35 27-26 49l23 22M255 258c27 6 37 29 23 52l-20 18" fill="none" stroke="url(#leoDark)" strokeWidth="25" strokeLinecap="round"/>
      <g fill="url(#leoShell)" stroke="#8d849f" strokeWidth="3"><circle cx="104" cy="329" r="19"/><circle cx="258" cy="328" r="19"/><path d="m91 326 5-10m7 4 5-8m6 14 6-6m125 5 5-10m7 4 5-8m6 14 6-6" strokeLinecap="round"/></g>
      <path d="m119 345-5 32q-3 9-13 12l-10 4q-6 6 5 8h64q14-3 8-14l-8-40zM200 347l-6 33q-4 9-13 13-7 6 4 8h65q13-3 5-14l-14-11-4-29z" fill="url(#leoShell)" stroke="#f7f3ff" strokeWidth="3"/>
      <path d="M97 388q33 9 66 0m21 0q33 9 66 0" fill="none" stroke="#b54cff" strokeWidth="5" strokeLinecap="round" filter="url(#leoGlow)"/>
      <path d="m119 354 5 21m107-21-5 21" stroke="#b2a9c4" strokeWidth="4" strokeLinecap="round"/>
      <g fill="#c15aff" filter="url(#leoGlow)"><path d="m312 67 4 11 11 4-11 4-4 11-4-11-11-4 11-4z"/><circle cx="45" cy="218" r="3"/><circle cx="319" cy="203" r="3"/></g>
    </svg>
  );
}
