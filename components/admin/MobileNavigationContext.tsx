"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

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
  const value = useMemo(() => ({ open, openMenu, closeMenu, toggleMenu }), [open, openMenu, closeMenu, toggleMenu]);
  return <MobileNavigationContext.Provider value={value}>{children}</MobileNavigationContext.Provider>;
}

export function useMobileNavigation() {
  const context = useContext(MobileNavigationContext);
  if (!context) throw new Error("useMobileNavigation must be used inside MobileNavigationProvider");
  return context;
}
