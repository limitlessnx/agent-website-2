import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ReelVisual } from "./reel-visual-model";

const ink = "#f4f1ff";
const muted = "#b2a9c7";
const violet = "#b794ff";
const panel: React.CSSProperties = { border: "1px solid #46335f", borderRadius: 24, background: "#12101c", padding: 30 };
const chip: React.CSSProperties = { border: "1px solid #72509e", borderRadius: 12, background: "#211631", padding: "10px 18px", color: "#dcc8ff", fontSize: 22 };

function Card({ title, detail, active = true }: { title: string; detail?: string; active?: boolean }) {
  return <div style={{ ...panel, borderColor: active ? "#8a61c4" : "#352d43", opacity: active ? 1 : .55 }}>
    <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.25 }}>{title}</div>
    {detail ? <div style={{ color: muted, fontSize: 24, marginTop: 12, lineHeight: 1.4 }}>{detail}</div> : null}
  </div>;
}

export function ReelIllustration({ visual }: { visual: ReelVisual }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = (index: number) => interpolate(frame, [index * fps * .3, index * fps * .3 + fps * .3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrow = <div aria-hidden style={{ color: violet, fontSize: 52, textAlign: "center", lineHeight: 1.1 }}>↓</div>;
  return <div data-reel-visual={visual.kind} style={{ ...panel, padding: 36, color: ink, width: "100%", boxSizing: "border-box", boxShadow: "0 25px 100px #0006" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
      <div style={{ fontSize: 25, fontWeight: 700 }}>{visual.title}</div>
      <div style={{ fontSize: 22, color: muted }}>Illustrative example</div>
    </div>
    {visual.kind === "inbox" ? <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}><span style={chip}>Support inbox</span><span style={{ ...chip, background: "transparent" }}>Tasks waiting</span></div>
      {visual.items.map((item, index) => <div key={index} style={{ opacity: reveal(index), display: "flex", alignItems: "center", gap: 20, ...panel, padding: "22px 26px" }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#583682", display: "grid", placeItems: "center", fontSize: 22 }}>?</div>
        <div style={{ fontSize: 29 }}>{item}</div><span style={{ marginLeft: "auto", color: muted, fontSize: 19 }}>New enquiry</span>
      </div>)}
    </div> : null}
    {visual.kind === "question_router" ? <div style={{ display: "grid", gap: 22 }}>
      <Card title={visual.title} detail="Identify what the customer needs" />{arrow}
      <svg width="100%" height="76" viewBox="0 0 800 76" aria-hidden><path d="M400 0V30H180V76M400 30H620V76" fill="none" stroke={violet} strokeWidth="3" /></svg>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <Card title={visual.items[0]} detail="Maia · configured answer" active={frame > fps * .5} />
        <Card title={visual.items[1]} detail="Your team · human review" active={frame > fps} />
      </div>
    </div> : null}
    {visual.kind === "answer" ? <div style={{ display: "grid", gap: 26 }}>
      <div style={{ ...panel, background: "#1a1724", marginLeft: 70 }}><div style={{ color: muted, fontSize: 21, marginBottom: 14 }}>CUSTOMER</div><div style={{ fontSize: 30, lineHeight: 1.45 }}>{visual.items.slice(0, 2).join(" ")}</div></div>
      <div style={{ display: "flex", gap: 12, opacity: reveal(1) }}><span style={chip}>{visual.items[2] || "Configured answer"}</span></div>
      <div style={{ opacity: reveal(2) }}><Card title="Maia · response preview" detail={visual.items[3] || "I can help with that. Let’s confirm the details of your enquiry."} /></div>
      <div style={{ color: muted, fontSize: 23 }}>Approved information → response → next step</div>
    </div> : null}
    {visual.kind === "capture" ? <div style={{ display: "grid", gap: 18 }}>{visual.items.map((item, index) => <div key={index} style={{ ...panel, padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ color: muted, fontSize: 22 }}>{item}</div><div style={{ fontSize: 26, marginTop: 10 }}>{frame > index * fps * .35 ? "Captured from conversation" : "Awaiting response"}</div></div>
      <span style={{ color: violet, fontSize: 34, opacity: reveal(index) }}>✓</span>
    </div>)}</div> : null}
    {visual.kind === "handoff" ? <div style={{ display: "grid", gap: 20 }}>
      <Card title={visual.items[0]} detail="Recognises a question needing judgment" />{arrow}
      <div style={{ ...chip, textAlign: "center", opacity: reveal(1) }}>Human review needed</div>{arrow}
      <div style={{ opacity: reveal(2) }}><Card title={visual.items[1]} detail={visual.items[2]} /></div>
      <div style={{ color: muted, fontSize: 23 }}>The conversation stays with the request.</div>
    </div> : null}
    {visual.kind === "overview" || visual.kind === "pipeline" ? <div style={{ display: "grid", gap: 12 }}>{visual.items.map((item, index) => <React.Fragment key={index}>
      {index ? arrow : null}<div style={{ opacity: reveal(index), display: "grid", gridTemplateColumns: "62px 1fr", alignItems: "center", gap: 20 }}>
        <span style={{ ...chip, textAlign: "center", padding: 14 }}>{String(index + 1).padStart(2, "0")}</span><Card title={item} />
      </div>
    </React.Fragment>)}</div> : null}
  </div>;
}
