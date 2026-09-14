"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "@/components/admin/ServerIcons";
import FluxLogo from "@/components/FluxLogo";
import styles from "@/components/Navbar.module.css";

const navLinks = [
  { href: "/services", label: "Services" },
  { href: "/industries", label: "Industries" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/evaluation", label: "Business AI Evaluation" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 18);
      if (currentScrollY < 80 || currentScrollY < lastScrollY - 4) setHidden(false);
      else if (currentScrollY > lastScrollY + 4) setHidden(true);
      lastScrollY = currentScrollY;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuPath(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuPath(null);

  return (
    <header className={`${styles.siteHeader} ${scrolled ? styles.scrolled : ""} ${hidden && !menuOpen ? styles.hidden : ""}`} data-home-nav={pathname === "/" ? "" : undefined}>
      <nav className={styles.siteNav} aria-label="Primary navigation">
        <Link className={styles.siteBrand} href="/" aria-label="Fluxknight home"><FluxLogo /></Link>
        <div className={styles.desktopLinks}>
          {navLinks.map((link) => (
            <Link className={pathname === link.href ? styles.active : ""} key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </div>
        <div className={styles.desktopActions}>
          <Link className={styles.loginLink} href="/account/login">Login</Link>
          <Link className={styles.demoLink} href="/evaluation">Book a Demo <span>↗</span></Link>
        </div>
        <button className={styles.mobileToggle} type="button" onClick={() => setMenuPath(pathname)} aria-label="Open navigation menu" aria-expanded={menuOpen}><Menu size={22} /></button>
      </nav>
      {menuOpen ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <button className={styles.backdrop} type="button" aria-label="Close navigation menu" onClick={closeMenu} />
          <aside className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <Link className={styles.drawerBrand} href="/" onClick={closeMenu} aria-label="Fluxknight home"><FluxLogo /></Link>
              <button className={styles.closeButton} type="button" onClick={closeMenu} aria-label="Close navigation menu"><X size={25} /></button>
            </div>
            <nav className={styles.mobileLinks} aria-label="Mobile navigation links">
              {navLinks.map((link) => (
                <Link className={pathname === link.href ? styles.active : ""} key={link.href} href={link.href} onClick={closeMenu}>{link.label}</Link>
              ))}
            </nav>
            <div className={styles.mobileActions}>
              <Link href="/account/login" onClick={closeMenu}>Login</Link>
              <Link className={styles.primary} href="/evaluation" onClick={closeMenu}>Book a Demo</Link>
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  );
}
