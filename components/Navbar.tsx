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

  useEffect(() => {
    if (!menuOpen) return;
    const body = document.body;
    const html = document.documentElement;
    const oldBodyOverflow = body.style.overflow;
    const oldHtmlOverflow = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.overflow = oldBodyOverflow;
      html.style.overflow = oldHtmlOverflow;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={scrolled ? "site-header is-scrolled" : "site-header"}>
      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="site-brand" href="/" aria-label="Fluxknight home"><FluxLogo /></Link>

        <div className="desktop-links">
          {navLinks.map((link) => (
            <Link className={pathname === link.href ? "active" : ""} key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </div>

        <div className="desktop-actions">
          <Link className="login-link" href="/account/login">Login</Link>
          <Link className="demo-link" href="/evaluation">Book a Demo <span>↗</span></Link>
        </div>

        <button className="mobile-toggle" type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation menu" aria-expanded={menuOpen}>
          <Menu size={22} />
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            className="fk-nav-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <button className="fk-nav-backdrop" type="button" aria-label="Close navigation menu" onClick={closeMenu} />
            <motion.aside
              className="fk-nav-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="fk-nav-header">
                <Link className="fk-nav-brand" href="/" onClick={closeMenu} aria-label="Fluxknight home"><FluxLogo /></Link>
                <button className="fk-nav-close" type="button" onClick={closeMenu} aria-label="Close navigation menu"><X size={25} /></button>
              </div>

              <nav className="fk-nav-links" aria-label="Mobile navigation links">
                {navLinks.map((link) => (
                  <Link className={pathname === link.href ? "active" : ""} key={link.href} href={link.href} onClick={closeMenu}>{link.label}</Link>
                ))}
              </nav>

              <div className="fk-nav-actions">
                <Link href="/account/login" onClick={closeMenu}>Login</Link>
                <Link className="primary" href="/evaluation" onClick={closeMenu}>Book a Demo</Link>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style jsx>{`
        .site-header { position: fixed; inset: 0 0 auto; z-index: 10000; padding: 16px 20px; pointer-events: none; transition: padding .25s ease; }
        .site-header.is-scrolled { padding-top: 10px; }
        .site-nav { pointer-events: auto; position: relative; width: min(1120px, 100%); min-height: 58px; margin: 0 auto; padding: 0 12px 0 18px; display: grid; grid-template-columns: minmax(180px,1fr) auto minmax(180px,1fr); align-items: center; gap: 18px; border: 1px solid rgba(190,153,255,.18); border-radius: 18px; background: #090512; box-shadow: 0 18px 55px rgba(8,2,18,.55), inset 0 1px rgba(255,255,255,.04); }
        .site-brand,.fk-nav-brand { display: inline-flex; align-items: center; width: fit-content; color: #fff; text-decoration: none; }
        .desktop-links { display:flex; align-items:center; justify-content:center; gap:4px; padding:4px; border:1px solid rgba(180,139,255,.1); border-radius:12px; background:rgba(255,255,255,.025); }
        .desktop-links a,.login-link { color:#aaa0c0; text-decoration:none; font-size:.78rem; white-space:nowrap; }
        .desktop-links a { padding:8px 11px; border-radius:8px; }
        .desktop-links a:hover,.desktop-links a.active { color:#fff; background:rgba(139,92,246,.12); }
        .desktop-actions { justify-self:end; display:flex; align-items:center; gap:8px; }
        .login-link { padding:9px 11px; }
        .demo-link { display:inline-flex; align-items:center; gap:7px; padding:10px 14px; border:1px solid rgba(205,179,255,.34); border-radius:10px; color:#fff; text-decoration:none; font-size:.78rem; font-weight:700; background:linear-gradient(135deg,#9b5cff,#6d36df); }
        .mobile-toggle { display:none; justify-self:end; width:42px; height:42px; place-items:center; border:1px solid rgba(180,139,255,.22); border-radius:12px; color:#fff; background:#130b24; cursor:pointer; }

        .fk-nav-overlay { pointer-events:auto; position:fixed; inset:0; z-index:2147483647; display:flex; justify-content:flex-end; background:#030106; isolation:isolate; }
        .fk-nav-backdrop { position:absolute; inset:0; z-index:0; width:100%; height:100%; border:0; padding:0; background:#030106; cursor:default; }
        .fk-nav-drawer { position:relative; z-index:1; width:min(390px,100vw); height:100dvh; min-height:100vh; padding:max(18px,env(safe-area-inset-top)) 18px max(22px,env(safe-area-inset-bottom)); display:flex; flex-direction:column; border-left:1px solid rgba(180,139,255,.28); background-color:#08040f; background-image:linear-gradient(180deg,rgba(91,45,190,.12),transparent 260px); box-shadow:-30px 0 100px rgba(0,0,0,.8); overflow-y:auto; overscroll-behavior:contain; }
        .fk-nav-header { flex:0 0 auto; min-height:74px; padding-bottom:15px; display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:1px solid rgba(180,139,255,.18); }
        .fk-nav-close { width:48px; height:48px; display:inline-grid; place-items:center; flex:0 0 auto; border:1px solid rgba(180,139,255,.3); border-radius:14px; color:#fff; background:#150b27; cursor:pointer; touch-action:manipulation; }
        .fk-nav-links { display:grid; gap:9px; padding:22px 0; }
        .fk-nav-links a { min-height:54px; padding:0 16px; display:flex; align-items:center; border:1px solid rgba(180,139,255,.12); border-radius:12px; color:#f6f1ff; text-decoration:none; font-size:1.05rem; font-weight:650; background:#10091d; }
        .fk-nav-links a.active { border-color:rgba(177,132,255,.42); background:linear-gradient(135deg,#42217b,#24143e); }
        .fk-nav-actions { margin-top:auto; padding-top:20px; display:grid; gap:10px; border-top:1px solid rgba(180,139,255,.18); }
        .fk-nav-actions a { min-height:52px; padding:14px; display:grid; place-items:center; border:1px solid rgba(180,139,255,.25); border-radius:12px; color:#ded4ef; text-align:center; text-decoration:none; font-weight:700; background:#10091e; }
        .fk-nav-actions a.primary { color:#fff; background:linear-gradient(135deg,#9b5cff,#6d36df); box-shadow:0 12px 32px rgba(91,45,190,.28); }

        @media (max-width:920px) {
          .site-header { padding:10px; }
          .site-nav { min-height:56px; grid-template-columns:1fr auto; padding:0 8px 0 15px; border-radius:16px; }
          .desktop-links,.desktop-actions { display:none; }
          .mobile-toggle { display:grid; }
        }
        @media (min-width:921px) { .fk-nav-overlay { display:none; } }
      `}</style>
    </header>
  );
}
