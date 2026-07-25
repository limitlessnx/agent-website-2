"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import FluxLogo from "@/components/FluxLogo";

const navLinks = [
  { href: "/services", label: "Services" },
  { href: "/industries", label: "Industries" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className={scrolled ? "flux-nav-wrap scrolled" : "flux-nav-wrap"}>
      <nav className="flux-nav">
        <Link className="flux-brand" href="/" aria-label="Fluxknight home"><FluxLogo /></Link>
        <div className="flux-nav-center hidden-mobile">
          {navLinks.map((link) => <Link className={pathname === link.href ? "active" : ""} key={link.href} href={link.href}>{link.label}</Link>)}
        </div>
        <div className="flux-nav-actions hidden-mobile">
          <Link className="flux-login" href="/account/login">Login</Link>
          <Link className="flux-contact" href="/evaluation">Book a Demo <span>↗</span></Link>
        </div>
        <button className="flux-menu-button show-mobile" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation menu" aria-expanded={menuOpen}>{menuOpen ? <X size={23} /> : <Menu size={23} />}</button>
      </nav>
      <AnimatePresence>
        {menuOpen ? <motion.div className="flux-mobile-menu" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
          {navLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          <div className="flux-mobile-actions"><Link href="/account/login">Login</Link><Link className="primary" href="/evaluation">Book a Demo</Link></div>
        </motion.div> : null}
      </AnimatePresence>
    </header>
  );
}
