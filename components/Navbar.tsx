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
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className={scrolled ? "site-header is-scrolled" : "site-header"}>
      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="site-brand" href="/" aria-label="Fluxknight home">
          <FluxLogo />
        </Link>

        <div className="desktop-links">
          {navLinks.map((link) => (
            <Link
              className={pathname === link.href ? "active" : ""}
              key={link.href}
              href={link.href}
            >
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
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.button
              className="menu-backdrop"
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="mobile-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mobile-links">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href}>{link.label}</Link>
                ))}
              </div>
              <div className="mobile-actions">
                <Link href="/account/login">Login</Link>
                <Link className="primary" href="/evaluation">Book a Demo</Link>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <style jsx>{`
        .site-header {
          position: fixed;
          inset: 0 0 auto;
          z-index: 2147483647;
          padding: 16px 20px;
          pointer-events: none;
          transition: padding .25s ease;
          isolation: isolate;
        }
        .site-header.is-scrolled { padding-top: 10px; }
        .site-nav {
          pointer-events: auto;
          position: relative;
          z-index: 4;
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
          background-color: #090512;
          box-shadow: 0 18px 55px rgba(8, 2, 18, .55), inset 0 1px rgba(255,255,255,.04);
        }
        .site-brand {
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
          background-color: #130b24;
          box-shadow: 0 8px 24px rgba(0,0,0,.28);
        }
        .menu-backdrop {
          pointer-events: auto;
          position: fixed;
          inset: 0;
          z-index: 1;
          border: 0;
          background: rgba(2, 1, 7, .84);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
        }
        .mobile-panel {
          pointer-events: auto;
          position: fixed;
          top: 78px;
          right: 10px;
          bottom: max(10px, env(safe-area-inset-bottom));
          z-index: 3;
          width: min(370px, calc(100vw - 20px));
          padding: 24px 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 1px solid rgba(180,139,255,.28);
          border-radius: 20px;
          background: #090512;
          box-shadow: -24px 24px 90px rgba(0,0,0,.72), inset 0 1px rgba(255,255,255,.04);
          overflow-y: auto;
          isolation: isolate;
        }
        .mobile-links { display: grid; }
        .mobile-links a {
          padding: 18px 10px;
          border-bottom: 1px solid rgba(180,139,255,.12);
          color: #f6f1ff;
          text-decoration: none;
          font-size: 1.05rem;
          font-weight: 650;
          background: #090512;
        }
        .mobile-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 28px;
          padding-top: 18px;
          border-top: 1px solid rgba(180,139,255,.12);
          background: #090512;
        }
        .mobile-actions a {
          padding: 14px;
          border: 1px solid rgba(180,139,255,.2);
          border-radius: 11px;
          color: #d3cae3;
          text-align: center;
          text-decoration: none;
          background-color: #10091e;
        }
        .mobile-actions a.primary {
          color: #fff;
          background: linear-gradient(135deg, #9b5cff, #6d36df);
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
        }
        @media (max-width: 420px) {
          .site-nav { min-height: 54px; }
          .mobile-panel { top: 74px; }
        }
      `}</style>
    </header>
  );
}
