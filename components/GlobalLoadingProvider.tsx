"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import FluxknightLoadingOverlay from "@/components/FluxknightLoadingOverlay";

type LoadingContextValue = { startLoading: () => void; stopLoading: () => void; isLoading: boolean };
const LoadingContext = createContext<LoadingContextValue>({ startLoading: () => undefined, stopLoading: () => undefined, isLoading: false });
export function useGlobalLoading() { return useContext(LoadingContext); }

export default function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const initialPath = useRef(pathname);
  const hydrated = useRef(false);
  const navigationTimer = useRef<number | null>(null);

  const startLoading = useCallback(() => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
    setIsLoading(true);
    navigationTimer.current = window.setTimeout(() => setIsLoading(false), 10000);
  }, []);

  const stopLoading = useCallback(() => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
    navigationTimer.current = null;
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 700);
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
      stopLoading();
    }
  }, [pathname, stopLoading]);

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
        startLoading();
      } catch { /* Ignore malformed hrefs. */ }
    }
    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [startLoading]);

  useEffect(() => () => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
  }, []);

  const value = useMemo<LoadingContextValue>(() => ({ startLoading, stopLoading, isLoading }), [isLoading, startLoading, stopLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <FluxknightLoadingOverlay visible={isLoading} />
    </LoadingContext.Provider>
  );
}
