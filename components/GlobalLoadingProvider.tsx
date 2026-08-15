"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import FluxLogo from "@/components/FluxLogo";

type LoadingContextValue = { startLoading: () => void; stopLoading: () => void; isLoading: boolean };
const LoadingContext = createContext<LoadingContextValue | null>(null);

export function useGlobalLoading() {
  const value = useContext(LoadingContext);
  if (!value) throw new Error("useGlobalLoading must be used inside GlobalLoadingProvider");
  return value;
}

export default function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const pendingRef = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationRef = useRef(false);
  const lastPath = useRef(pathname);

  const stopLoading = useCallback(() => {
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    if (pendingRef.current > 0 || navigationRef.current) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setActive(false);
      setTimeout(() => setVisible(false), 220);
    }, 140);
  }, []);

  const startLoading = useCallback(() => {
    pendingRef.current += 1;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    setVisible(true);
    requestAnimationFrame(() => setActive(true));
    safetyTimer.current = setTimeout(() => {
      pendingRef.current = 0;
      navigationRef.current = false;
      setActive(false);
      setTimeout(() => setVisible(false), 220);
    }, 15000);
  }, []);

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      navigationRef.current = false;
      pendingRef.current = 0;
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      setActive(false);
      setTimeout(() => setVisible(false), 220);
    }
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      navigationRef.current = true;
      startLoading();
      pendingRef.current = 1;
    };
    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || event.defaultPrevented) return;
      startLoading();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [startLoading]);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const input = args[0];
      const init = args[1];
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      const body = init?.body;
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method) || body instanceof FormData;
      if (!isMutation) return originalFetch(...args);
      startLoading();
      try { return await originalFetch(...args); }
      finally { stopLoading(); }
    };
    return () => { window.fetch = originalFetch; };
  }, [startLoading, stopLoading]);

  const value = useMemo(() => ({ startLoading, stopLoading, isLoading: visible }), [startLoading, stopLoading, visible]);

  return <LoadingContext.Provider value={value}>
    {children}
    {visible && <div className={`flux-global-loading ${active ? "is-active" : ""}`} role="status" aria-live="polite" aria-label="Fluxknight is working">
      <div className="flux-loading-core">
        <div className="flux-loading-orbit" aria-hidden="true" />
        <FluxLogo className="flux-loading-logo" />
        <span className="flux-loading-label">Fluxknight is working</span>
        <span className="flux-loading-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    </div>}
  </LoadingContext.Provider>;
}
