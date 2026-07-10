"use client";

import Link from "next/link";
import { Zap, Globe, ExternalLink, Share } from "lucide-react";

const footerLinks = {
  Services: [
    { href: "/services#ai-sales-agent", label: "AI Sales Agent" },
    { href: "/services#whatsapp", label: "WhatsApp AI Assistant" },
    { href: "/services#voice", label: "AI Voice Agent" },
    { href: "/services#crm", label: "CRM Automation" },
    { href: "/services#support", label: "AI Customer Support" },
  ],
  Company: [
    { href: "/about", label: "About" },
    { href: "/case-studies", label: "Case Studies" },
    { href: "/industries", label: "Industries" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact" },
  ],
  Industries: [
    { href: "/industries#real-estate", label: "Real Estate" },
    { href: "/industries#computer-sales", label: "Computer Sales" },
    { href: "/industries#ecommerce", label: "E-commerce" },
    { href: "/industries#clinics", label: "Clinics" },
    { href: "/industries#logistics", label: "Logistics" },
  ],
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "#06080f",
        borderTop: "1px solid #1e2d3d",
        padding: "64px 24px 32px",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Top */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "48px",
            marginBottom: "48px",
          }}
          className="footer-grid"
        >
          {/* Brand */}
          <div style={{ maxWidth: "320px" }}>
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
                marginBottom: "16px",
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
                  color: "#f0f6ff",
                }}
              >
                Boundless Flux <span style={{ color: "#00d4ff" }}>AI</span>
              </span>
            </Link>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#8ba3bd",
                lineHeight: 1.7,
                marginBottom: "24px",
              }}
            >
              We build AI employees and automation systems for businesses that
              want to sell, support, and scale — without adding headcount.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              {[
                { icon: Globe, href: "#", label: "Website" },
                { icon: ExternalLink, href: "#", label: "LinkedIn" },
                { icon: Share, href: "#", label: "Social" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  style={{
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #1e2d3d",
                    borderRadius: "8px",
                    color: "#8ba3bd",
                    transition: "color 0.2s, border-color 0.2s",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.color = "#00d4ff";
                    el.style.borderColor = "rgba(0,212,255,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.color = "#8ba3bd";
                    el.style.borderColor = "#1e2d3d";
                  }}
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#4d6478",
                  marginBottom: "16px",
                }}
              >
                {group}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {links.map((link) => (
                  <li key={link.label} style={{ marginBottom: "10px" }}>
                    <Link
                      href={link.href}
                      style={{
                        fontSize: "0.875rem",
                        color: "#8ba3bd",
                        textDecoration: "none",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        ((e.target as HTMLElement).style.color = "#f0f6ff")
                      }
                      onMouseLeave={(e) =>
                        ((e.target as HTMLElement).style.color = "#8ba3bd")
                      }
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div
          style={{
            paddingTop: "32px",
            borderTop: "1px solid #1e2d3d",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ fontSize: "0.8rem", color: "#4d6478" }}>
            © {year} Boundless Flux AI. All rights reserved.
          </p>
          <p style={{ fontSize: "0.8rem", color: "#4d6478" }}>
            Built with AI. Powered by automation.
          </p>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .footer-grid {
            grid-template-columns: 1.5fr 1fr 1fr 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
