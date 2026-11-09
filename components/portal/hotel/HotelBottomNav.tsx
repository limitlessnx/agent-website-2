"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, CalendarDays, BedDouble, Users, ConciergeBell, Menu } from "lucide-react";
import styles from "./HotelMobileShell.module.css";
export default function HotelBottomNav({ customers, open, onMore }: { customers: boolean; open: boolean; onMore: () => void }) {
  const pathname = usePathname(), query = useSearchParams();
  const items = [{ href: "/portal", label: "Home", Icon: Home, active: pathname === "/portal" }, ...(customers ? [
    { href: "/portal/hotel", label: "Bookings", Icon: CalendarDays, active: pathname === "/portal/hotel" && query.get("tab") !== "rooms" },
    { href: "/portal/hotel?tab=rooms", label: "Rooms", Icon: BedDouble, active: pathname === "/portal/hotel" && query.get("tab") === "rooms" },
    { href: "/portal/customers", label: "Guests", Icon: Users, active: pathname.startsWith("/portal/customers") },
    { href: "/portal/hotel/catalog?kind=service", label: "Services", Icon: ConciergeBell, active: pathname.startsWith("/portal/hotel/catalog") },
  ] : [])];
  return <nav className={`${styles.bottomNav} ${!customers ? styles.shortNav : ""}`} aria-label="Hotel mobile navigation">{items.map(({ href, label, Icon, active }) => <Link key={label} href={href} aria-current={active ? "page" : undefined}><Icon size={21} /><span>{label}</span></Link>)}<button type="button" onClick={onMore} aria-expanded={open} aria-label="More hotel navigation"><Menu size={21} /><span>More</span></button></nav>;
}
