"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChevronDown, LayoutDashboard, Menu, Settings, ShoppingBag, X, Zap, Boxes } from "lucide-react";
import { useEffect, useState } from "react";

export default function PortalSidebar({ organization }: { organization: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const agentsActive = pathname === "/portal/agents" || pathname.startsWith("/portal/agents/");
  const [agentsOpen, setAgentsOpen] = useState(agentsActive);

  useEffect(() => {
    if (agentsActive) setAgentsOpen(true);
    setOpen(false);
  }, [pathname, agentsActive]);

  const active = (href: string, exact = false) => exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button className="portal-mobile-toggle" type="button" onClick={() => setOpen(true)} aria-label="Open client dashboard navigation"><Menu size={21} /></button>
      {open ? <button className="portal-backdrop" type="button" onClick={() => setOpen(false)} aria-label="Close client dashboard navigation" /> : null}
      <aside className={`portal-sidebar ${open ? "is-open" : ""}`}>
        <div className="portal-mobile-head"><button type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
        <div className="portal-workspace-identity"><span className="portal-workspace-icon"><Zap size={18} /></span><div><small>Organization</small><strong>{organization}</strong><em>Client Admin</em></div></div>
        <Link href="/portal" className="portal-brand" onClick={() => setOpen(false)}><strong>Fluxknight</strong><small>Client workspace</small></Link>
        <nav aria-label="Client dashboard navigation">
          <Link href="/portal" className={active("/portal", true) ? "active" : ""}><LayoutDashboard size={18} /><span>Dashboard</span></Link>
          <Link href="/portal/systems" className={active("/portal/systems") ? "active" : ""}><Boxes size={18} /><span>My Systems</span></Link>
          <Link href="/portal/marketplace" className={active("/portal/marketplace") ? "active" : ""}><ShoppingBag size={18} /><span>Marketplace</span></Link>
          <section className={`portal-nav-drawer ${agentsActive ? "active" : ""}`}>
            <button type="button" onClick={() => setAgentsOpen((current) => !current)} aria-expanded={agentsOpen}><span><Bot size={18} />Agents</span><ChevronDown size={16} className={agentsOpen ? "open" : ""} /></button>
            <div className={agentsOpen ? "portal-nav-drawer-items open" : "portal-nav-drawer-items"}>
              <Link href="/portal/agents" className={pathname === "/portal/agents" ? "active" : ""}>All agents</Link>
              <Link href="/portal/agents/setup" className={pathname.startsWith("/portal/agents/setup") ? "active" : ""}>Business setup</Link>
            </div>
          </section>
          <Link href="/portal/settings" className={active("/portal/settings") ? "active" : ""}><Settings size={18} /><span>Settings</span></Link>
        </nav>
        <div className="portal-sidebar-note"><span>Workspace status</span><strong><i /> Tenant secured</strong></div>
      </aside>
    </>
  );
}
