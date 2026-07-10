"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow: string;
  headline: ReactNode;
  subheadline?: string;
  centered?: boolean;
}

export default function SectionHeader({
  eyebrow,
  headline,
  subheadline,
  centered = true,
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        textAlign: centered ? "center" : "left",
        marginBottom: "56px",
      }}
    >
      <p className="section-label" style={{ marginBottom: "16px" }}>
        {eyebrow}
      </p>
      <h2
        style={{
          fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          color: "#f0f6ff",
          maxWidth: centered ? "680px" : "none",
          margin: centered ? "0 auto 20px" : "0 0 20px",
        }}
      >
        {headline}
      </h2>
      {subheadline && (
        <p
          style={{
            fontSize: "1.05rem",
            color: "#8ba3bd",
            lineHeight: 1.7,
            maxWidth: "580px",
            margin: centered ? "0 auto" : "0",
          }}
        >
          {subheadline}
        </p>
      )}
    </motion.div>
  );
}
