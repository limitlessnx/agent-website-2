"use client";

import { Moon, Sun } from "@/components/admin/ServerIcons";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "limitless-dashboard-theme";

function resolveTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  const root = document.getElementById("dashboard-theme-root");
  if (!root) return;
  root.dataset.dashboardTheme = theme;
  root.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const initial = resolveTheme();
    applyTheme(initial);
    setTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemThemeChange = () => {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
      const next: Theme = media.matches ? "light" : "dark";
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  function toggleTheme() {
    const current = theme ?? resolveTheme();
    const next: Theme = current === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const current = theme ?? "dark";
  return (
    <button
      type="button"
      className="admin-icon-button"
      onClick={toggleTheme}
      aria-label={current === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={current === "dark" ? "Light mode" : "Dark mode"}
      data-theme-toggle
    >
      {current === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
