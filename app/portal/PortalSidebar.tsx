"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Boxes, ChevronDown, LayoutDashboard, LifeBuoy, Menu, Settings, ShoppingBag, X, Zap } from "@/components/admin/ServerIcons";
import { useState } from "react";

export default function PortalSidebar({ organization }: { organization: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const agentsActive = pathname === "/portal/agents" || pathname.startsWith("/portal/agents/");
  const [agentsOpen, setAgentsOpen] = useState(agentsActive);
  const drawerOpen = agentsOpen || agentsActive;
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
          <Link href="/portal" className={active("/portal", true) ? "active" : ""} onClick={() => setOpen(false)}><LayoutDashboard size={18} /><span>Dashboard</span></Link>
          <Link href="/portal/systems" className={active("/portal/systems") ? "active" : ""} onClick={() => setOpen(false)}><Boxes size={18} /><span>My Systems</span></Link>
          <Link href="/portal/marketplace" className={active("/portal/marketplace") ? "active" : ""} onClick={() => setOpen(false)}><ShoppingBag size={18} /><span>Marketplace</span></Link>
          <section className={`portal-nav-drawer ${agentsActive ? "active" : ""}`}>
            <button type="button" onClick={() => setAgentsOpen((current) => !current)} aria-expanded={drawerOpen}><span><Bot size={18} />Agents</span><ChevronDown size={16} className={drawerOpen ? "open" : ""} /></button>
            <div className={drawerOpen ? "portal-nav-drawer-items open" : "portal-nav-drawer-items"}>
              <Link href="/portal/agents" className={pathname === "/portal/agents" ? "active" : ""} onClick={() => setOpen(false)}>All agents</Link>
              <Link href="/portal/agents/setup" className={pathname.startsWith("/portal/agents/setup") ? "active" : ""} onClick={() => setOpen(false)}>Business setup</Link>
            </div>
          </section>
          <Link href="/portal/support" className={active("/portal/support") ? "active" : ""} onClick={() => setOpen(false)}><LifeBuoy size={18} /><span>Support agent</span></Link>
          <Link href="/portal/settings" className={active("/portal/settings") ? "active" : ""} onClick={() => setOpen(false)}><Settings size={18} /><span>Settings</span></Link>
        </nav>
        <div className="portal-sidebar-note"><span>Workspace status</span><strong><i /> Tenant secured</strong></div>
      </aside>
    </>
  );
}
