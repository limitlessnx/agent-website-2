"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  Building2,
  Command,
  CreditCard,
  Search,
  Send,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react";
import styles from "@/components/admin/PlatformChrome.module.css";

const commands = [
  { label: "Open executive overview", href: "/dashboard", group: "Navigate", icon: Activity },
  { label: "Open client onboarding", href: "/dashboard/clients", group: "Navigate", icon: Users },
  { label: "Open Limitless leads", href: "/dashboard/limitless/leads", group: "Limitless Realty", icon: Users },
  { label: "Open property registry", href: "/dashboard/limitless/properties", group: "Limitless Realty", icon: Building2 },
  { label: "Open WhatsApp campaigns", href: "/dashboard/limitless/campaigns", group: "Limitless Realty", icon: Send },
  { label: "Open payments and installments", href: "/dashboard/limitless/payments", group: "Limitless Realty", icon: CreditCard },
  { label: "Open agent registry", href: "/dashboard/agents", group: "AI Operations", icon: Bot },
  { label: "Open workflow registry", href: "/dashboard/workflows", group: "AI Operations", icon: Workflow },
  { label: "Open platform settings", href: "/dashboard/settings", group: "System", icon: Settings },
];

export default function PlatformChrome() {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setActivityOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return commands;
    return commands.filter((item) => `${item.label} ${item.group}`.toLowerCase().includes(value));
  }, [query]);

  function go(href: string) {
    setPaletteOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button type="button" className={styles.commandButton} onClick={() => setPaletteOpen(true)}>
        <Command size={16} />
        <span>Command</span>
        <kbd>⌘K</kbd>
      </button>
      <button type="button" className={styles.activityButton} aria-label="Open activity center" onClick={() => setActivityOpen(true)}>
        <Activity size={17} />
        <i />
      </button>

      {paletteOpen ? (
        <div className={styles.overlay} role="presentation" onMouseDown={() => setPaletteOpen(false)}>
          <section className={styles.palette} role="dialog" aria-modal="true" aria-label="Fluxknight command palette" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.searchRow}>
              <Search size={18} />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search organizations, agents, workflows and records..." />
              <button type="button" onClick={() => setPaletteOpen(false)} aria-label="Close command palette"><X size={17} /></button>
            </div>
            <div className={styles.commandList}>
              {filtered.map((item) => (
                <button type="button" key={item.href} onClick={() => go(item.href)}>
                  <span className={styles.commandIcon}><item.icon size={16} /></span>
                  <span><strong>{item.label}</strong><small>{item.group}</small></span>
                </button>
              ))}
              {!filtered.length ? <p>No matching command found.</p> : null}
            </div>
          </section>
        </div>
      ) : null}

      {activityOpen ? (
        <>
          <button type="button" className={styles.drawerBackdrop} aria-label="Close activity center" onClick={() => setActivityOpen(false)} />
          <aside className={styles.drawer} aria-label="Unified activity center">
            <header>
              <div><strong>Activity Center</strong><span>Cross-organization operations</span></div>
              <button type="button" onClick={() => setActivityOpen(false)} aria-label="Close activity center"><X size={18} /></button>
            </header>
            <div className={styles.activityList}>
              <article><i className={styles.live} /><div><strong>Maia WhatsApp operations active</strong><span>Limitless Realty · live automation</span></div></article>
              <article><i className={styles.info} /><div><strong>Campaign delivery reporting enabled</strong><span>Sent, delivered, pending and failed states</span></div></article>
              <article><i className={styles.warn} /><div><strong>Review incomplete operational records</strong><span>Use workspace action cards to resolve blockers</span></div></article>
            </div>
            <a href="/dashboard/automations">Open automation control</a>
          </aside>
        </>
      ) : null}
    </>
  );
}
