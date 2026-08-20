"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type LoadingContextValue = { startLoading: () => void; stopLoading: () => void; isLoading: boolean };
const LoadingContext = createContext<LoadingContextValue>({ startLoading: () => undefined, stopLoading: () => undefined, isLoading: false });
export function useGlobalLoading() { return useContext(LoadingContext); }

export default function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const initialPath = useRef(pathname);
  const hydrated = useRef(false);
  const startLoading = useCallback(() => setIsLoading(true), []);
  const stopLoading = useCallback(() => setIsLoading(false), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      initialPath.current = pathname;
      return;
    }
    if (pathname !== initialPath.current) {
      initialPath.current = pathname;
      setIsLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;
      try {
        const url = new URL(rawHref, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        setIsLoading(true);
      } catch { /* Ignore malformed hrefs. */ }
    }
    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => setIsLoading(false), 12000);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  const value = useMemo<LoadingContextValue>(() => ({ startLoading, stopLoading, isLoading }), [isLoading, startLoading, stopLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <div className={`fluxknight-loading-overlay${isLoading ? " is-visible" : ""}`} aria-hidden="true">
        <div className="fluxknight-loading-orbit" />
        <div className="fluxknight-loading-core">
          <span className="fluxknight-loading-wordmark">FLUXKNIGHT</span>
          <span className="fluxknight-loading-label">AI OPERATIONS PLATFORM</span>
        </div>
      </div>
      <style jsx global>{`
        .fluxknight-loading-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;pointer-events:none;opacity:0;visibility:hidden;background:rgba(5,4,15,.32);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);transition:opacity 180ms ease,visibility 180ms ease}
        .fluxknight-loading-overlay.is-visible{opacity:1;visibility:visible}
        .fluxknight-loading-core{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:7px;padding:28px 34px;border:1px solid rgba(171,118,255,.32);border-radius:18px;background:rgba(10,7,25,.76);box-shadow:0 0 70px rgba(126,70,255,.18),inset 0 0 28px rgba(126,70,255,.06)}
        .fluxknight-loading-wordmark{color:#f8f5ff;font-family:Inter,Arial,Helvetica,sans-serif;font-size:clamp(20px,4vw,30px);font-weight:500;letter-spacing:.28em;padding-left:.28em}
        .fluxknight-loading-label{color:#a99aba;font-family:Inter,Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:.28em;padding-left:.28em}
        .fluxknight-loading-orbit{position:absolute;width:128px;height:128px;border:2px solid rgba(168,107,255,.12);border-top-color:rgba(185,130,255,.95);border-right-color:rgba(132,76,255,.65);border-radius:50%;box-shadow:0 0 35px rgba(132,76,255,.22);animation:fluxknight-loading-spin 1.05s linear infinite}
        .fluxknight-loading-orbit::after{content:"";position:absolute;width:7px;height:7px;top:8px;left:50%;border-radius:50%;background:#d8baff;box-shadow:0 0 14px rgba(216,186,255,.95);transform:translateX(-50%)}
        @keyframes fluxknight-loading-spin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion:reduce){.fluxknight-loading-orbit{animation-duration:2.5s}}
      `}</style>
    </LoadingContext.Provider>
  );
}
