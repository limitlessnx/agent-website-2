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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    if (menuOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [menuOpen]);

  return (
    <header className={`${scrolled ? "site-header is-scrolled" : "site-header"}${menuOpen ? " menu-is-open" : ""}`}>
      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="site-brand" href="/" aria-label="Fluxknight home">
          <FluxLogo />
        </Link>

        <div className="desktop-links">
          {navLinks.map((link) => (
            <Link className={pathname === link.href ? "active" : ""} key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="desktop-actions">
          <Link className="login-link" href="/account/login">Login</Link>
          <Link className="demo-link" href="/evaluation">Book a Demo <span>↗</span></Link>
        </div>

        <button
          className="mobile-toggle"
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
        >
          <Menu size={22} />
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            className="mobile-menu-layer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <motion.aside
              className="mobile-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="mobile-panel-header">
                <Link className="mobile-brand" href="/" aria-label="Fluxknight home">
                  <FluxLogo />
                </Link>
                <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation menu">
                  <X size={24} />
                </button>
              </div>

              <nav className="mobile-links" aria-label="Mobile navigation links">
                {navLinks.map((link) => (
                  <Link className={pathname === link.href ? "active" : ""} key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mobile-actions">
                <Link href="/account/login">Login</Link>
                <Link className="primary" href="/evaluation">Book a Demo</Link>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style jsx>{`
        .site-header {
          position: fixed;
          inset: 0 0 auto;
          z-index: 2147483000;
          padding: 16px 20px;
          pointer-events: none;
          transition: padding .25s ease;
        }
        .site-header.is-scrolled { padding-top: 10px; }
        .site-nav {
          pointer-events: auto;
          position: relative;
          z-index: 2;
          width: min(1120px, 100%);
          min-height: 58px;
          margin: 0 auto;
          padding: 0 12px 0 18px;
          display: grid;
          grid-template-columns: minmax(180px, 1fr) auto minmax(180px, 1fr);
          align-items: center;
          gap: 18px;
          border: 1px solid rgba(190, 153, 255, .18);
          border-radius: 18px;
          background: #090512;
          box-shadow: 0 18px 55px rgba(8, 2, 18, .55), inset 0 1px rgba(255,255,255,.04);
        }
        .site-brand,
        .mobile-brand {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          color: #fff;
          text-decoration: none;
        }
        .desktop-links {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 4px;
          border: 1px solid rgba(180, 139, 255, .1);
          border-radius: 12px;
          background: rgba(255,255,255,.025);
        }
        .desktop-links a,
        .login-link {
          color: #aaa0c0;
          text-decoration: none;
          font-size: .78rem;
          white-space: nowrap;
        }
        .desktop-links a { padding: 8px 11px; border-radius: 8px; transition: .2s ease; }
        .desktop-links a:hover,
        .desktop-links a.active { color: #fff; background: rgba(139, 92, 246, .12); }
        .desktop-actions {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .login-link { padding: 9px 11px; }
        .demo-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 14px;
          border: 1px solid rgba(205, 179, 255, .34);
          border-radius: 10px;
          color: #fff;
          text-decoration: none;
          font-size: .78rem;
          font-weight: 700;
          background: linear-gradient(135deg, #9b5cff, #6d36df);
          box-shadow: 0 8px 24px rgba(91,45,190,.24);
        }
        .mobile-toggle {
          display: none;
          justify-self: end;
          width: 42px;
          height: 42px;
          place-items: center;
          border: 1px solid rgba(180,139,255,.22);
          border-radius: 12px;
          color: #fff;
          background: #130b24;
          box-shadow: 0 8px 24px rgba(0,0,0,.28);
          cursor: pointer;
        }
        .mobile-menu-layer {
          pointer-events: auto;
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: flex;
          justify-content: flex-end;
          background: #05020a;
          overflow: hidden;
        }
        .mobile-panel {
          width: min(390px, 100vw);
          height: 100dvh;
          min-height: 100vh;
          padding: max(18px, env(safe-area-inset-top)) 18px max(22px, env(safe-area-inset-bottom));
          display: flex;
          flex-direction: column;
          border-left: 1px solid rgba(180,139,255,.25);
          background: #08040f;
          box-shadow: -30px 0 100px rgba(0,0,0,.72);
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .mobile-panel-header {
          flex: 0 0 auto;
          min-height: 76px;
          padding: 0 0 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid rgba(180,139,255,.16);
        }
        .mobile-panel-header button {
          width: 48px;
          height: 48px;
          display: inline-grid;
          place-items: center;
          flex: 0 0 auto;
          border: 1px solid rgba(180,139,255,.28);
          border-radius: 14px;
          color: #fff;
          background: #130b24;
          cursor: pointer;
        }
        .mobile-links {
          display: grid;
          gap: 6px;
          padding: 24px 0;
        }
        .mobile-links a {
          min-height: 54px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          border: 1px solid transparent;
          border-radius: 12px;
          color: #f6f1ff;
          text-decoration: none;
          font-size: 1.05rem;
          font-weight: 650;
          background: #0d0717;
        }
        .mobile-links a.active {
          border-color: rgba(177,132,255,.34);
          background: linear-gradient(135deg, rgba(139,92,246,.3), rgba(83,42,156,.28));
        }
        .mobile-actions {
          margin-top: auto;
          padding-top: 20px;
          display: grid;
          gap: 10px;
          border-top: 1px solid rgba(180,139,255,.16);
        }
        .mobile-actions a {
          min-height: 52px;
          padding: 14px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(180,139,255,.22);
          border-radius: 12px;
          color: #d3cae3;
          text-align: center;
          text-decoration: none;
          font-weight: 700;
          background: #10091e;
        }
        .mobile-actions a.primary {
          color: #fff;
          background: linear-gradient(135deg, #9b5cff, #6d36df);
          box-shadow: 0 12px 32px rgba(91,45,190,.28);
        }
        @media (max-width: 920px) {
          .site-header { padding: 10px; }
          .site-nav {
            min-height: 56px;
            grid-template-columns: 1fr auto;
            padding: 0 8px 0 15px;
            border-radius: 16px;
          }
          .desktop-links,
          .desktop-actions { display: none; }
          .mobile-toggle { display: grid; }
          .menu-is-open .site-nav { visibility: hidden; }
        }
        @media (min-width: 921px) {
          .mobile-menu-layer { display: none; }
        }
      `}</style>
    </header>
  );
}