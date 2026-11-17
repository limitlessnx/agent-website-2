"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Clock3,
  CreditCard,
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
import { NavigationItem } from "@/components/ui/DashboardPrimitives";
import FluxLogo from "@/components/FluxLogo";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useDialogFocusTrap } from "@/components/admin/useDialogFocusTrap";
import HotelBottomNav from "@/components/portal/hotel/HotelBottomNav";
import type { IndustryExperience } from "@/lib/industryExperience";

export type PortalNavCapabilities = {
  customers:boolean;
  conversations:boolean;
  systems:boolean;
  appointments:boolean;
  analytics:boolean;
  billing:boolean;
  team:boolean;
  support:boolean;
};

export default function PortalSidebar({
  organization,
  role,
  capabilities,
  unreadNotifications = 0,
  experience,
}: {
  organization:string;
  role:string;
  capabilities:PortalNavCapabilities;
  unreadNotifications?:number;
  experience: IndustryExperience;
}) {
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  const active=(href:string,exact=false)=>exact?pathname===href:pathname===href||pathname.startsWith(`${href}/`);
  const close=useCallback(()=>setOpen(false),[]);
  const sidebarRef=useRef<HTMLElement>(null);
  useDialogFocusTrap(open,sidebarRef,close);
  useEffect(()=>{
    const media=window.matchMedia("(max-width:820px)");
    const sync=()=>{
      if(sidebarRef.current) sidebarRef.current.inert=media.matches&&!open;
      if(!media.matches) close();
    };
    sync();media.addEventListener("change",sync);
    return ()=>media.removeEventListener("change",sync);
  },[open,close]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=previous;};
  },[open]);

  return <>
    <button className="portal-mobile-toggle" type="button" onClick={()=>setOpen(true)} aria-label="Open client dashboard navigation" aria-expanded={open} aria-controls="portal-mobile-navigation"><Menu size={21}/></button>
    {open?<button className="portal-backdrop" type="button" onClick={close} aria-label="Close client dashboard navigation"/>:null}
    <aside ref={sidebarRef} id="portal-mobile-navigation" className={`portal-sidebar ${open?"is-open":""}`} aria-label="Workspace navigation" role={open?"dialog":undefined} aria-modal={open?true:undefined} tabIndex={open?-1:undefined}>
      <div className="portal-mobile-head"><button type="button" onClick={close} aria-label="Close navigation"><X size={20}/></button></div>
      <Link href="/portal" className="portal-brand portal-brand-logo" onClick={close} aria-label="Fluxknight client workspace home"><FluxLogo/><small>Client workspace</small></Link>
      <div className="portal-workspace-identity"><span className="portal-workspace-icon"><Zap size={18}/></span><div><small>Business workspace</small><strong>{organization}</strong><em>{role.replaceAll("-"," ")}</em></div></div>

      <nav aria-label="Client dashboard navigation">
        <span className="portal-nav-label">Workspace</span>
        <NavigationItem href="/portal" active={active("/portal",true)} onClick={close}><LayoutDashboard size={18}/><span>Overview</span></NavigationItem>
        <NavigationItem href="/portal/notifications" active={active("/portal/notifications")} onClick={close}><Bell size={18}/><span>Needs Attention</span>{unreadNotifications>0?<small>{unreadNotifications>99?"99+":unreadNotifications}</small>:null}</NavigationItem>
        {capabilities.customers?<NavigationItem href="/portal/customers" active={active("/portal/customers")} onClick={close}><Users size={18}/><span>{experience.customerLabel}</span><span className="sr-only">Customers</span></NavigationItem>:null}
        {capabilities.conversations?<NavigationItem href={experience.slug === "hotels"?"/portal/hotel/inbox":"/portal/conversations"} active={active(experience.slug === "hotels"?"/portal/hotel/inbox":"/portal/conversations")} onClick={close}><MessageSquareText size={18}/><span>Conversations</span></NavigationItem>:null}
        {capabilities.systems?<NavigationItem href="/portal/systems" active={active("/portal/systems")} onClick={close}><Workflow size={18}/><span>Systems</span></NavigationItem>:null}
        {capabilities.customers&&experience.slug === "hotels"?<><NavigationItem href="/portal/hotel" active={active("/portal/hotel",true)} onClick={close}><Clock3 size={18}/><span>Hotel workspace</span></NavigationItem><NavigationItem href="/portal/hotel/catalog" active={active("/portal/hotel/catalog")} onClick={close}><Workflow size={18}/><span>Hotel Catalog</span></NavigationItem></>:null}
        {capabilities.appointments&&experience.features.appointments&&experience.slug !== "hotels"?<NavigationItem href="/portal/appointments" active={active("/portal/appointments")} onClick={close}><Clock3 size={18}/><span>{experience.appointmentLabel}</span></NavigationItem>:null}
        {capabilities.customers&&experience.slug === "hotels"?<><NavigationItem href="/portal/hotel/reports" active={active("/portal/hotel/reports")} onClick={close}><Activity size={18}/><span>Hotel reports</span></NavigationItem><NavigationItem href="/portal/hotel/followups" active={active("/portal/hotel/followups")} onClick={close}><Clock3 size={18}/><span>Follow-ups & reminders</span></NavigationItem></>:null}
        {experience.slug === "photography-studio"?<NavigationItem href="/portal/catalogue" active={active("/portal/catalogue")} onClick={close}><Workflow size={18}/><span>Studio Catalogue</span></NavigationItem>:null}
        {capabilities.conversations && ["photography-studio", "hotels"].includes(experience.slug)?<NavigationItem href="/portal/campaigns" active={active("/portal/campaigns")} onClick={close}><Zap size={18}/><span>Campaigns</span></NavigationItem>:null}
        {capabilities.analytics?<NavigationItem href="/portal/analytics" active={active("/portal/analytics")} onClick={close}><Activity size={18}/><span>Analytics</span></NavigationItem>:null}
        {capabilities.billing?<NavigationItem href="/portal/billing" active={active("/portal/billing")} onClick={close}><CreditCard size={18}/><span>Flux Credits</span></NavigationItem>:null}
        {capabilities.team?<NavigationItem href="/portal/team" active={active("/portal/team")} onClick={close}><Users size={18}/><span>Team</span></NavigationItem>:null}

        <span className="portal-nav-label">Help & Settings</span>
        {experience.slug === "hotels"?<NavigationItem href="/portal/hotel/setup" active={active("/portal/hotel/setup")} onClick={close}><Settings size={18}/><span>Hotel setup</span></NavigationItem>:null}
        {capabilities.support?<NavigationItem href="/portal/support" active={active("/portal/support")} onClick={close}><LifeBuoy size={18}/><span>Support</span></NavigationItem>:null}
        <NavigationItem href="/portal/settings" active={active("/portal/settings")} onClick={close}><Settings size={18}/><span>Settings</span></NavigationItem>
      </nav>

      <div className="portal-sidebar-note"><span>Workspace status</span><strong><i/> Tenant secured</strong></div>
    </aside>
    {experience.slug === "hotels" ? <Suspense fallback={null}><HotelBottomNav customers={capabilities.customers} open={open} onMore={()=>setOpen(true)}/></Suspense> : null}
  </>;
}
