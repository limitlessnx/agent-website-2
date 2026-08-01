"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Cable, ChevronDown, LayoutDashboard, Menu, Settings, Workflow, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const links = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/portal/integrations", label: "Integrations", icon: Cable },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

export default function PortalSidebar({ organization }: { organization: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const agentsActive = pathname === "/portal/agents" || pathname.startsWith("/portal/agents/");
  const [agentsOpen, setAgentsOpen] = useState(agentsActive);

  useEffect(() => {
    if (agentsActive) setAgentsOpen(true);
    setOpen(false);
  }, [pathname, agentsActive]);

  return (
    <>
      <button className="portal-mobile-toggle" type="button" onClick={() => setOpen(true)} aria-label="Open client dashboard navigation">
        <Menu size={21} />
      </button>
      {open ? <button className="portal-backdrop" type="button" onClick={() => setOpen(false)} aria-label="Close client dashboard navigation" /> : null}
      <aside className={`portal-sidebar ${open ? "is-open" : ""}`}>
        <div className="portal-mobile-head">
          <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <div className="portal-workspace-identity">
          <span className="portal-workspace-icon"><Zap size={18} /></span>
          <div>
            <small>Organization</small>
            <strong>{organization}</strong>
            <em>Client Admin</em>
          </div>
        </div>

        <Link href="/portal" className="portal-brand" onClick={() => setOpen(false)}>
          <strong>Fluxknight</strong>
          <small>Client workspace</small>
        </Link>

        <nav aria-label="Client dashboard navigation">
          <Link href="/portal" className={pathname === "/portal" ? "active" : ""}><LayoutDashboard size={18} /><span>Dashboard</span></Link>

          <section className={`portal-nav-drawer ${agentsActive ? "active" : ""}`}>
            <button type="button" onClick={() => setAgentsOpen((current) => !current)} aria-expanded={agentsOpen}>
              <span><Bot size={18} />Agents</span>
              <ChevronDown size={16} className={agentsOpen ? "open" : ""} />
            </button>
            <div className={agentsOpen ? "portal-nav-drawer-items open" : "portal-nav-drawer-items"}>
              <Link href="/portal/agents" className={pathname === "/portal/agents" ? "active" : ""}>All agents</Link>
              <Link href="/portal/agents/setup" className={pathname.startsWith("/portal/agents/setup") ? "active" : ""}>Setup workspace</Link>
              <Link href="/portal/agents/workflows" className={pathname.startsWith("/portal/agents/workflows") ? "active" : ""}><Workflow size={14} />Workflow assignments</Link>
            </div>
          </section>

          {links.slice(1).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon size={18} /><span>{item.label}</span></Link>;
          })}
        </nav>

        <div className="portal-sidebar-note">
          <span>Workspace status</span>
          <strong><i /> Tenant secured</strong>
        </div>
      </aside>
    </>
  );
}
