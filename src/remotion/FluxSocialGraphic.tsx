import React from "react";
import { AbsoluteFill, Img } from "remotion";

export type FluxSocialGraphicProps = {
  kind: "static" | "carousel";
  logoUrl: string;
  pillar: string;
  headline: string;
  body?: string;
  footer?: string;
  slideType?: string;
  index?: number;
  total?: number;
};

const grid = {
  position: "absolute" as const,
  inset: 0,
  opacity: 0.08,
  backgroundImage:
    "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
  backgroundSize: "54px 54px",
};

export const FluxSocialGraphic: React.FC<FluxSocialGraphicProps> = ({
  kind,
  logoUrl,
  pillar,
  headline,
  body = "",
  footer = "",
  slideType = "insight",
  index = 1,
  total = 1,
}) => {
  const isCarousel = kind === "carousel";
  const label = isCarousel && index > 1 ? slideType.toUpperCase() : pillar;

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 82% 12%, rgba(124,58,237,.36), transparent 34%), linear-gradient(145deg,#050507,#0b0b12 55%,#050507)",
        color: "white",
        fontFamily: "Arial, Helvetica, sans-serif",
        overflow: "hidden",
      }}
    >
      <div style={grid} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: isCarousel ? "72px 72px 58px" : "76px 72px 62px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Img
            src={logoUrl}
            style={{ width: 250, height: 72, objectFit: "contain", objectPosition: "left center" }}
          />
          <div
            style={{
              fontSize: isCarousel ? 20 : 18,
              color: "#a1a1aa",
              letterSpacing: isCarousel ? 0 : ".08em",
            }}
          >
            {isCarousel
              ? `${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`
              : "AI BUSINESS SYSTEMS"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 900 }}>
          <div
            style={{
              alignSelf: "flex-start",
              border: "1px solid rgba(139,92,246,.42)",
              background: "rgba(139,92,246,.08)",
              borderRadius: 999,
              padding: "10px 18px",
              color: "#c4b5fd",
              fontSize: isCarousel ? 21 : 22,
              lineHeight: 1.1,
            }}
          >
            {label.slice(0, isCarousel ? 38 : 42)}
          </div>
          <div
            style={{
              fontSize: isCarousel ? (index === 1 ? 84 : 72) : 86,
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-.04em",
              maxWidth: 910,
            }}
          >
            {headline.slice(0, isCarousel ? (index === 1 ? 120 : 100) : 140)}
          </div>
          {isCarousel && body ? (
            <div style={{ fontSize: 34, lineHeight: 1.3, color: "#d4d4d8", maxWidth: 870 }}>
              {body.slice(0, 270)}
            </div>
          ) : null}
          <div
            style={{
              width: isCarousel ? 140 : 150,
              height: isCarousel ? 7 : 8,
              borderRadius: 99,
              background: "linear-gradient(90deg,#8b5cf6,#c084fc)",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 21 }}>
          <div style={{ color: isCarousel ? "#a1a1aa" : "#d4d4d8", maxWidth: 720, lineHeight: 1.35 }}>
            {isCarousel ? "Business systems, not AI theatre." : footer.slice(0, 120)}
          </div>
          <div style={{ color: "#a78bfa", fontWeight: 700 }}>Fluxknight.space</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
