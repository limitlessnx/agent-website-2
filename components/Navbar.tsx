"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Zap } from "lucide-react";

const navLinks = [
  { href: "/services", label: "Services" },
  { href: "/industries", label: "Industries" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: "background 0.3s, border-color 0.3s",
        background: scrolled
          ? "rgba(6, 8, 15, 0.92)"
          : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled
          ? "1px solid rgba(30, 45, 61, 0.8)"
          : "1px solid transparent",
      }}
    >
      <nav
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 24px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              background: "linear-gradient(135deg, #00d4ff, #0066aa)",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <span
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#f0f6ff",
            }}
          >
            Boundless Flux{" "}
            <span style={{ color: "#00d4ff" }}>AI</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
          className="hidden-mobile"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "6px 14px",
                fontSize: "0.85rem",
                fontWeight: 500,
                color:
                  pathname === link.href
                    ? "#00d4ff"
                    : "#8ba3bd",
                textDecoration: "none",
                borderRadius: "6px",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.color = "#f0f6ff")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.color =
                  pathname === link.href ? "#00d4ff" : "#8ba3bd")
              }
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/contact"
            style={{
              marginLeft: "12px",
              padding: "8px 20px",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#06080f",
              background: "#00d4ff",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "opacity 0.2s, box-shadow 0.2s",
              boxShadow: "0 0 20px rgba(0,212,255,0.2)",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.opacity = "0.9";
              (e.target as HTMLElement).style.boxShadow =
                "0 0 30px rgba(0,212,255,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.opacity = "1";
              (e.target as HTMLElement).style.boxShadow =
                "0 0 20px rgba(0,212,255,0.2)";
            }}
          >
            Book a Call
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          style={{
            display: "none",
            background: "none",
            border: "none",
            color: "#f0f6ff",
            cursor: "pointer",
            padding: "4px",
          }}
          className="show-mobile"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "rgba(6, 8, 15, 0.98)",
              borderTop: "1px solid #1e2d3d",
              padding: "16px 24px 24px",
            }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "block",
                  padding: "12px 0",
                  fontSize: "1rem",
                  fontWeight: 500,
                  color:
                    pathname === link.href ? "#00d4ff" : "#8ba3bd",
                  textDecoration: "none",
                  borderBottom: "1px solid #1e2d3d",
                }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/contact"
              style={{
                display: "block",
                marginTop: "16px",
                padding: "12px 0",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#00d4ff",
                textDecoration: "none",
                textAlign: "center",
                border: "1px solid rgba(0,212,255,0.4)",
                borderRadius: "8px",
              }}
            >
              Book a Free Strategy Call →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
        @media (min-width: 769px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </header>
  );
}
