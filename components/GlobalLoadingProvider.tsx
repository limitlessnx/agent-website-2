"use client";

import { createContext, useContext, useMemo } from "react";

type LoadingContextValue = {
  startLoading: () => void;
  stopLoading: () => void;
  isLoading: boolean;
};

const LoadingContext = createContext<LoadingContextValue>({
  startLoading: () => undefined,
  stopLoading: () => undefined,
  isLoading: false,
});

export function useGlobalLoading() {
  return useContext(LoadingContext);
}

/**
 * Global route/loading animation was intentionally retired.
 * Navigation, form submissions, API calls and Leo chat must not display
 * the old full-screen Fluxknight animation. The context remains available
 * so existing components that call useGlobalLoading() continue to work.
 */
export default function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<LoadingContextValue>(() => ({
    startLoading: () => undefined,
    stopLoading: () => undefined,
    isLoading: false,
  }), []);

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}
