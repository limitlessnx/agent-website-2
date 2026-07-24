"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Zap } from "lucide-react";

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

  return (
    <header className={scrolled ? "flux-nav-wrap scrolled" : "flux-nav-wrap"}>
      <nav className="flux-nav">
        <Link className="flux-brand" href="/">
          <span className="flux-brand-mark"><Zap size={15} strokeWidth={2.6} /></span>
          <span>Fluxknight</span>
        </Link>

        <div className="flux-nav-center hidden-mobile">
          {navLinks.map((link) => (
            <Link className={pathname === link.href ? "active" : ""} key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flux-nav-actions hidden-mobile">
          <Link className="flux-login" href="/account/login">Login</Link>
          <Link className="flux-contact" href="/account/signup">Create Account <span>↗</span></Link>
        </div>

        <button className="flux-menu-button show-mobile" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation menu" aria-expanded={menuOpen}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div className="flux-mobile-menu" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>
            ))}
            <div className="flux-mobile-actions">
              <Link href="/account/login" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link className="primary" href="/account/signup" onClick={() => setMenuOpen(false)}>Create Account</Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style>{`
        .flux-nav-wrap{position:fixed;inset:0 0 auto;z-index:100;padding:16px 20px;transition:.3s ease;pointer-events:none}
        .flux-nav-wrap.scrolled{padding-top:10px}
        .flux-nav{pointer-events:auto;max-width:1120px;height:52px;margin:auto;padding:0 10px 0 14px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border:1px solid rgba(196,162,255,.16);border-radius:16px;background:rgba(12,7,23,.68);backdrop-filter:blur(24px);box-shadow:0 18px 60px rgba(15,3,36,.28),inset 0 1px rgba(255,255,255,.04)}
        .flux-brand{display:flex;align-items:center;gap:9px;color:#fff;text-decoration:none;font-size:.92rem;font-weight:750;letter-spacing:-.02em}
        .flux-brand-mark{width:28px;height:28px;display:grid;place-items:center;color:#fff;border-radius:9px;background:linear-gradient(145deg,#b36cff,#6735e2);box-shadow:0 0 22px rgba(139,92,246,.38)}
        .flux-nav-center{display:flex;align-items:center;padding:4px;border:1px solid rgba(188,146,255,.1);border-radius:11px;background:rgba(255,255,255,.025)}
        .flux-nav-center a{padding:7px 12px;color:#9e94b4;text-decoration:none;font-size:.76rem;border-radius:8px;transition:.2s ease}
        .flux-nav-center a:hover,.flux-nav-center a.active{color:#fff;background:linear-gradient(135deg,rgba(139,92,246,.22),rgba(139,92,246,.08));box-shadow:inset 0 0 0 1px rgba(183,143,255,.14)}
        .flux-nav-actions{justify-self:end;display:flex;align-items:center;gap:8px}
        .flux-login{padding:8px 11px;color:#b6acc8;text-decoration:none;font-size:.78rem}
        .flux-contact{display:flex;align-items:center;gap:7px;padding:9px 14px;color:#fff;text-decoration:none;font-size:.78rem;font-weight:700;border:1px solid rgba(205,179,255,.34);border-radius:10px;background:linear-gradient(135deg,#9b5cff,#6d36df);box-shadow:0 8px 24px rgba(91,45,190,.25)}
        .flux-menu-button{justify-self:end;display:none;border:0;background:transparent;color:#fff;padding:6px}
        .flux-mobile-menu{pointer-events:auto;margin:10px auto 0;max-width:calc(100% - 12px);padding:14px;border:1px solid rgba(190,153,255,.16);border-radius:16px;background:rgba(10,5,20,.96);backdrop-filter:blur(24px);box-shadow:0 24px 70px rgba(0,0,0,.45)}
        .flux-mobile-menu>a{display:block;padding:13px 8px;color:#afa4c3;text-decoration:none;border-bottom:1px solid rgba(180,139,255,.1)}
        .flux-mobile-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
        .flux-mobile-actions a{text-align:center;padding:12px;color:#c5bbd7;text-decoration:none;border:1px solid rgba(180,139,255,.14);border-radius:10px}
        .flux-mobile-actions a.primary{color:#fff;background:linear-gradient(135deg,#9b5cff,#6d36df)}
        @media(max-width:768px){.hidden-mobile{display:none!important}.show-mobile{display:flex!important}.flux-nav{grid-template-columns:1fr auto;height:50px}.flux-nav-wrap{padding:10px}.flux-mobile-menu{max-width:100%}}
        @media(min-width:769px){.show-mobile{display:none!important}}
      `}</style>
    </header>
  );
}
