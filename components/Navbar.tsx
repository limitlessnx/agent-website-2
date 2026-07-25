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
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
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
          z-index: 200;
          padding: 16px 20px;
          pointer-events: none;
          transition: padding .25s ease;
        }
        .site-header.is-scrolled { padding-top: 10px; }
        .site-nav {
          pointer-events: auto;
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
          background: rgba(9, 5, 18, .82);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow: 0 18px 55px rgba(8, 2, 18, .35), inset 0 1px rgba(255,255,255,.04);
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
          border: 1px solid rgba(180,139,255,.16);
          border-radius: 12px;
          color: #fff;
          background: rgba(255,255,255,.035);
        }
        .menu-backdrop {
          pointer-events: auto;
          position: fixed;
          inset: 0;
          z-index: -1;
          border: 0;
          background: rgba(3, 1, 8, .72);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .mobile-panel {
          pointer-events: auto;
          width: min(calc(100% - 24px), 520px);
          margin: 10px auto 0;
          padding: 14px;
          border: 1px solid rgba(190,153,255,.18);
          border-radius: 18px;
          background: rgba(9,5,18,.98);
          box-shadow: 0 26px 70px rgba(0,0,0,.5);
        }
        .mobile-links { display: grid; }
        .mobile-links a {
          padding: 15px 10px;
          border-bottom: 1px solid rgba(180,139,255,.1);
          color: #d3cae3;
          text-decoration: none;
          font-size: 1rem;
        }
        .mobile-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
        }
        .mobile-actions a {
          padding: 13px;
          border: 1px solid rgba(180,139,255,.16);
          border-radius: 11px;
          color: #d3cae3;
          text-align: center;
          text-decoration: none;
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
          .mobile-panel { width: calc(100% - 20px); }
        }
      `}</style>
    </header>
  );
}
