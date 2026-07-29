"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LayoutDashboard, Menu, Settings, Workflow, X, Zap } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/portal/agents", label: "Agents", icon: Bot },
  { href: "/portal/workflows", label: "Workflows", icon: Workflow },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

export default function PortalSidebar({ organization }: { organization: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="portal-mobile-toggle" type="button" onClick={() => setOpen(true)} aria-label="Open portal navigation">
        <Menu size={21} />
      </button>
      {open ? <button className="portal-backdrop" type="button" onClick={() => setOpen(false)} aria-label="Close portal navigation" /> : null}
      <aside className={`portal-sidebar ${open ? "is-open" : ""}`}>
        <div className="portal-mobile-head">
          <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <Link href="/portal" className="portal-brand" onClick={() => setOpen(false)}>
          <span><Zap size={18} /></span>
          <div><strong>Fluxknight</strong><small>{organization}</small></div>
        </Link>
        <nav>
          {links.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}>
                <Icon size={18} /><span>{item.label}</span>
              </Link>
            );
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