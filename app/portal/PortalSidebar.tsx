"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Settings,
  ShoppingBag,
  WalletCards,
  Workflow,
  X,
  Zap,
  PlugZap,
} from "@/components/admin/ServerIcons";
import FluxLogo from "@/components/FluxLogo";
import { useState } from "react";

export default function PortalSidebar({ organization, unreadNotifications = 0 }: { organization: string; unreadNotifications?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string, exact = false) => exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const close = () => setOpen(false);

  return (
    <>
      <button className="portal-mobile-toggle" type="button" onClick={() => setOpen(true)} aria-label="Open client dashboard navigation"><Menu size={21} /></button>
      {open ? <button className="portal-backdrop" type="button" onClick={close} aria-label="Close client dashboard navigation" /> : null}

      <aside className={`portal-sidebar ${open ? "is-open" : ""}`}>
        <div className="portal-mobile-head"><button type="button" onClick={close} aria-label="Close navigation"><X size={20} /></button></div>

        <Link href="/portal" className="portal-brand portal-brand-logo" onClick={close} aria-label="Fluxknight client workspace home">
          <FluxLogo />
          <small>Client workspace</small>
        </Link>

        <div className="portal-workspace-identity">
          <span className="portal-workspace-icon"><Zap size={18} /></span>
          <div>
            <small>Business workspace</small>
            <strong>{organization}</strong>
            <em>Client Admin</em>
          </div>
        </div>

        <nav aria-label="Client dashboard navigation">
          <span className="portal-nav-label">Business</span>
          <Link href="/portal" className={active("/portal", true) ? "active" : ""} onClick={close}><LayoutDashboard size={18} /><span>Home</span></Link>
          <Link href="/portal/notifications" className={active("/portal/notifications") ? "active" : ""} onClick={close}><Bell size={18} /><span>Needs Attention</span>{unreadNotifications > 0 ? <small>{unreadNotifications > 99 ? "99+" : unreadNotifications}</small> : null}</Link>

          <span className="portal-nav-label">AI Operations</span>
          <Link href="/portal/agents" className={active("/portal/agents") ? "active" : ""} onClick={close}><Bot size={18} /><span>AI Team</span></Link>
          <Link href="/portal/systems" className={active("/portal/systems") ? "active" : ""} onClick={close}><Workflow size={18} /><span>Automations</span></Link>
          <Link href="/portal/integrations" className={active("/portal/integrations") ? "active" : ""} onClick={close}><PlugZap size={18} /><span>Integrations</span></Link>

          <span className="portal-nav-label">Account</span>
          <Link href="/portal/billing" className={active("/portal/billing") ? "active" : ""} onClick={close}><WalletCards size={18} /><span>Plan & Usage</span></Link>
          <Link href="/portal/marketplace" className={active("/portal/marketplace") ? "active" : ""} onClick={close}><ShoppingBag size={18} /><span>Add AI Systems</span></Link>
          <Link href="/portal/support" className={active("/portal/support") ? "active" : ""} onClick={close}><LifeBuoy size={18} /><span>Support</span></Link>
          <Link href="/portal/settings" className={active("/portal/settings") ? "active" : ""} onClick={close}><Settings size={18} /><span>Settings</span></Link>
        </nav>

        <div className="portal-sidebar-note">
          <span>Workspace status</span>
          <strong><i /> Secure & connected</strong>
        </div>
      </aside>
    </>
  );
}
