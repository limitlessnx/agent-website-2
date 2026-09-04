import { ImageResponse } from "next/og";

export const alt = "Fluxknight AI automation for connected customer operations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 76px",
          color: "white",
          background:
            "radial-gradient(circle at 72% 34%, rgba(151,82,255,.34), transparent 34%), linear-gradient(135deg, #07030f 0%, #120722 58%, #07030f 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 58,
              height: 58,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              fontSize: 31,
              fontWeight: 900,
              background: "linear-gradient(135deg, #a78bfa, #6d35e8)",
            }}
          >
            F
          </div>
          <div style={{ display: "flex", fontSize: 27, fontWeight: 900, letterSpacing: 2.5 }}>
            FLUXKNIGHT
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: 900 }}>
          <div style={{ color: "#c99aff", fontSize: 19, fontWeight: 800, letterSpacing: 2.2, textTransform: "uppercase" }}>
            Connected AI operations
          </div>
          <div style={{ marginTop: 17, fontSize: 63, lineHeight: 1.02, fontWeight: 900, letterSpacing: -3.2 }}>
            Grow your organization without growing the workload.
          </div>
          <div style={{ marginTop: 22, color: "#c5b8d2", fontSize: 24, lineHeight: 1.45 }}>
            Faster response. Stronger follow-up. Less repetitive work. Better operational visibility.
          </div>
        </div>

        <div style={{ display: "flex", color: "#8f809e", fontSize: 18 }}>
          fluxknight.space
        </div>
      </div>
    ),
    size,
  );
}
