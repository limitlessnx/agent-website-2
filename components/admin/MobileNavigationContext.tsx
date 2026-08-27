"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const MobileNavigationContext = createContext<{
  open: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
} | null>(null);

export function MobileNavigationProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openMenu = useCallback(() => setOpen(true), []);
  const closeMenu = useCallback(() => setOpen(false), []);
  const toggleMenu = useCallback(() => setOpen((current) => !current), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  const value = useMemo(() => ({ open, openMenu, closeMenu, toggleMenu }), [open, openMenu, closeMenu, toggleMenu]);
  return <MobileNavigationContext.Provider value={value}>{children}</MobileNavigationContext.Provider>;
}

export function useMobileNavigation() {
  const context = useContext(MobileNavigationContext);
  if (!context) throw new Error("useMobileNavigation must be used inside MobileNavigationProvider");
  return context;
}
