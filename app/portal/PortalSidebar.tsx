"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Clock3,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessageSquareText,
  Settings,
  Users,
  Workflow,
  X,
  Zap,
} from "@/components/admin/ServerIcons";
import FluxLogo from "@/components/FluxLogo";
import { useState } from "react";

export type PortalNavCapabilities = {
  customers:boolean;
  conversations:boolean;
  systems:boolean;
  appointments:boolean;
  analytics:boolean;
  team:boolean;
  support:boolean;
};

export default function PortalSidebar({
  organization,
  role,
  capabilities,
  unreadNotifications = 0,
}: {
  organization:string;
  role:string;
  capabilities:PortalNavCapabilities;
  unreadNotifications?:number;
}) {
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  const active=(href:string,exact=false)=>exact?pathname===href:pathname===href||pathname.startsWith(`${href}/`);
  const close=()=>setOpen(false);

  return <>
    <button className="portal-mobile-toggle" type="button" onClick={()=>setOpen(true)} aria-label="Open client dashboard navigation"><Menu size={21}/></button>
    {open?<button className="portal-backdrop" type="button" onClick={close} aria-label="Close client dashboard navigation"/>:null}
    <aside className={`portal-sidebar ${open?"is-open":""}`}>
      <div className="portal-mobile-head"><button type="button" onClick={close} aria-label="Close navigation"><X size={20}/></button></div>
      <Link href="/portal" className="portal-brand portal-brand-logo" onClick={close} aria-label="Fluxknight client workspace home"><FluxLogo/><small>Client workspace</small></Link>
      <div className="portal-workspace-identity"><span className="portal-workspace-icon"><Zap size={18}/></span><div><small>Business workspace</small><strong>{organization}</strong><em>{role.replaceAll("-"," ")}</em></div></div>

      <nav aria-label="Client dashboard navigation">
        <span className="portal-nav-label">Workspace</span>
        <Link href="/portal" className={active("/portal",true)?"active":""} onClick={close}><LayoutDashboard size={18}/><span>Overview</span></Link>
        <Link href="/portal/notifications" className={active("/portal/notifications")?"active":""} onClick={close}><Bell size={18}/><span>Needs Attention</span>{unreadNotifications>0?<small>{unreadNotifications>99?"99+":unreadNotifications}</small>:null}</Link>
        {capabilities.customers?<Link href="/portal/customers" className={active("/portal/customers")?"active":""} onClick={close}><Users size={18}/><span>Customers</span></Link>:null}
        {capabilities.conversations?<Link href="/portal/conversations" className={active("/portal/conversations")?"active":""} onClick={close}><MessageSquareText size={18}/><span>Conversations</span></Link>:null}
        {capabilities.systems?<Link href="/portal/systems" className={active("/portal/systems")?"active":""} onClick={close}><Workflow size={18}/><span>Systems</span></Link>:null}
        {capabilities.appointments?<Link href="/portal/appointments" className={active("/portal/appointments")?"active":""} onClick={close}><Clock3 size={18}/><span>Appointments</span></Link>:null}
        {capabilities.analytics?<Link href="/portal/analytics" className={active("/portal/analytics")?"active":""} onClick={close}><Activity size={18}/><span>Analytics</span></Link>:null}
        {capabilities.team?<Link href="/portal/team" className={active("/portal/team")?"active":""} onClick={close}><Users size={18}/><span>Team</span></Link>:null}

        <span className="portal-nav-label">Help & Settings</span>
        {capabilities.support?<Link href="/portal/support" className={active("/portal/support")?"active":""} onClick={close}><LifeBuoy size={18}/><span>Support</span></Link>:null}
        <Link href="/portal/settings" className={active("/portal/settings")?"active":""} onClick={close}><Settings size={18}/><span>Settings</span></Link>
      </nav>

      <div className="portal-sidebar-note"><span>Workspace status</span><strong><i/> Tenant secured</strong></div>
    </aside>
  </>;
}
