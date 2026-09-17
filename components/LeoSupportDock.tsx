"use client";

import { useState } from "react";
import PublicLeoConsultant from "@/components/PublicLeoConsultant";
import { MessageCircle, X } from "@/components/admin/ServerIcons";

export default function LeoSupportDock() {
  const [open, setOpen] = useState(false);

  function toggleLeo() {
    const target = document.querySelector<HTMLElement>(open ? ".public-leo-close" : ".public-leo-launcher");
    target?.click();
    setOpen((current) => !current);
  }

  return (
    <>
      <PublicLeoConsultant />
      <button
        type="button"
        className={`leo-support-toggle ${open ? "is-open" : ""}`}
        onClick={toggleLeo}
        aria-label={open ? "Close Leo support" : "Open Leo support"}
        aria-expanded={open}
      >
        <span className="leo-support-toggle-core" aria-hidden="true">{open ? <X size={18} /> : <MessageCircle size={20} />}</span>
        <span className="leo-support-toggle-badge" aria-hidden="true">AI</span>
      </button>
      <style jsx global>{`
        .public-leo:not(.open) .public-leo-launcher{visibility:hidden!important;pointer-events:none!important}
        .public-leo.open{bottom:92px!important}
        .leo-support-toggle{position:fixed;right:22px;bottom:22px;z-index:91;width:58px;height:58px;display:grid;place-items:center;padding:0;border:1px solid rgba(167,139,250,.38);border-radius:16px;color:#fff;background:linear-gradient(145deg,rgba(24,24,27,.98),rgba(10,10,10,.98));box-shadow:0 18px 55px rgba(0,0,0,.48),0 0 0 1px rgba(139,92,246,.08),0 0 32px rgba(139,92,246,.16);backdrop-filter:blur(18px);cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
        .leo-support-toggle:hover{transform:translateY(-2px);border-color:rgba(196,181,253,.58);box-shadow:0 20px 60px rgba(0,0,0,.52),0 0 38px rgba(139,92,246,.22)}
        .leo-support-toggle-core{display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(167,139,250,.3);border-radius:10px;color:#c4b5fd;background:linear-gradient(145deg,rgba(139,92,246,.22),rgba(24,24,27,.88))}
        .leo-support-toggle-badge{position:absolute;right:-5px;top:-6px;padding:3px 5px;border:1px solid rgba(167,139,250,.3);border-radius:6px;color:#c4b5fd;background:#18181b;font:700 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}
        .leo-support-toggle.is-open .leo-support-toggle-core{background:rgba(139,92,246,.16)}
        @media(max-width:520px){.public-leo.open{bottom:78px!important}.leo-support-toggle{right:12px;bottom:12px;width:54px;height:54px;border-radius:15px}}
        @media(prefers-reduced-motion:reduce){.leo-support-toggle{transition:none}}
      `}</style>
    </>
  );
}
