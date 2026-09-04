import Link from "next/link";
import type { IndustryDefinition, PlanKey } from "@/lib/industryCatalog";
import { planDefinitions } from "@/lib/industryCatalog";

const colors = {
  bg: "#080311",
  panel: "rgba(18,9,31,.92)",
  panelSoft: "rgba(24,12,40,.72)",
  border: "rgba(168,85,247,.22)",
  borderStrong: "rgba(192,132,252,.42)",
  purpleSoft: "#d8b4fe",
  text: "#fbf8ff",
  muted: "#aaa0bb",
};

function PlanExample({ industry, planKey }: { industry: IndustryDefinition; planKey: PlanKey }) {
  const text = planKey === "basic" ? industry.basicExample : planKey === "starter" ? industry.starterExample : planKey === "business" ? industry.businessExample : industry.businessPlusExample;
  return (
    <div style={{ marginTop: 18, padding: "14px 16px", borderRadius: 14, background: "rgba(126,34,206,.12)", border: `1px solid ${colors.border}` }}>
      <span style={{ display: "block", marginBottom: 6, color: colors.purpleSoft, fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>For {industry.name}</span>
      <p style={{ margin: 0, color: colors.muted, fontSize: 14, lineHeight: 1.65 }}>{text}</p>
    </div>
  );
}

export default function IndustryDetailPage({ industry }: { industry: IndustryDefinition }) {
  const evaluationHref = `/evaluation?industry=${encodeURIComponent(industry.slug)}`;
  return (
    <main style={{ background: colors.bg, color: colors.text }}>
      <section style={{ padding: "138px 24px 88px", borderBottom: `1px solid ${colors.border}`, background: "radial-gradient(circle at 50% 0%, rgba(126,34,206,.24), transparent 44%), linear-gradient(180deg,#0d0619 0%,#080311 100%)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <Link href="/industries" style={{ color: colors.purpleSoft, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>← All industries</Link>
          <p style={{ margin: "28px 0 14px", color: colors.purpleSoft, fontSize: 12, fontWeight: 850, letterSpacing: ".18em", textTransform: "uppercase" }}>Fluxknight for {industry.name}</p>
          <h1 style={{ maxWidth: 900, margin: 0, fontSize: "clamp(2.6rem,6vw,5.2rem)", lineHeight: 1.02, letterSpacing: "-.055em", fontWeight: 900 }}>{industry.hero}</h1>
          <p style={{ maxWidth: 760, margin: "24px 0 0", color: colors.muted, fontSize: "clamp(1rem,2vw,1.18rem)", lineHeight: 1.8 }}>{industry.subhead}</p>
          {industry.channels && <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 24 }}>{industry.channels.map((channel) => <span key={channel} style={{ padding: "8px 12px", borderRadius: 999, border: `1px solid ${colors.border}`, background: "rgba(255,255,255,.025)", color: colors.muted, fontSize: 12, fontWeight: 750 }}>{channel}</span>)}</div>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 34 }}>
            <Link href={evaluationHref} style={{ padding: "13px 22px", borderRadius: 999, color: "#fff", fontWeight: 850, textDecoration: "none", background: "linear-gradient(135deg,#a855f7,#7c3aed)", border: "1px solid rgba(216,180,254,.24)" }}>Evaluate My Business</Link>
            <a href="#plans" style={{ padding: "13px 22px", borderRadius: 999, color: colors.text, fontWeight: 800, textDecoration: "none", background: "rgba(255,255,255,.03)", border: `1px solid ${colors.border}` }}>See plans</a>
          </div>
        </div>
      </section>

      <section style={{ padding: "84px 24px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 22 }}>
          <article style={{ padding: 28, borderRadius: 20, background: colors.panel, border: `1px solid ${colors.border}` }}><span style={{ color: colors.purpleSoft, fontSize: 11, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase" }}>Where friction happens</span><ul style={{ margin: "20px 0 0", paddingLeft: 20, color: colors.muted, lineHeight: 1.8 }}>{industry.problem.map((item) => <li key={item} style={{ marginBottom: 8 }}>{item}</li>)}</ul></article>
          <article style={{ padding: 28, borderRadius: 20, background: colors.panel, border: `1px solid ${colors.border}` }}><span style={{ color: colors.purpleSoft, fontSize: 11, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase" }}>What improves</span><ul style={{ margin: "20px 0 0", paddingLeft: 20, color: colors.muted, lineHeight: 1.8 }}>{industry.outcomes.map((item) => <li key={item} style={{ marginBottom: 8 }}>{item}</li>)}</ul></article>
        </div>
      </section>

      <section style={{ padding: "20px 24px 88px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}><span style={{ color: colors.purpleSoft, fontSize: 11, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase" }}>Customer journey</span><h2 style={{ margin: "10px 0 26px", fontSize: "clamp(2rem,4vw,3.2rem)", letterSpacing: "-.045em" }}>A clearer path from first contact to human action.</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>{industry.journey.map((step, index) => <div key={step} style={{ padding: "18px 16px", borderRadius: 16, background: colors.panelSoft, border: `1px solid ${colors.border}` }}><span style={{ display: "block", color: colors.purpleSoft, fontSize: 11, fontWeight: 900 }}>{String(index + 1).padStart(2, "0")}</span><strong style={{ display: "block", marginTop: 8, fontSize: 14 }}>{step}</strong></div>)}</div></div>
      </section>

      {industry.workflowSteps && industry.workflowSteps.length > 0 && <section style={{ padding: "88px 24px", borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`, background: "rgba(12,5,24,.72)" }}><div style={{ maxWidth: 1160, margin: "0 auto" }}><span style={{ color: colors.purpleSoft, fontSize: 11, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase" }}>How the system operates</span><h2 style={{ margin: "12px 0 12px", maxWidth: 840, fontSize: "clamp(2.2rem,4.5vw,3.8rem)", letterSpacing: "-.05em" }}>{industry.workflowTitle}</h2><p style={{ maxWidth: 760, margin: "0 0 32px", color: colors.muted, lineHeight: 1.8 }}>{industry.workflowIntro}</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>{industry.workflowSteps.map((step, index) => <article key={step.title} style={{ padding: 24, borderRadius: 18, background: colors.panel, border: `1px solid ${colors.border}` }}><span style={{ color: colors.purpleSoft, fontSize: 11, fontWeight: 900 }}>STEP {String(index + 1).padStart(2, "0")}</span><h3 style={{ margin: "10px 0 8px", fontSize: 20, letterSpacing: "-.025em" }}>{step.title}</h3><p style={{ margin: 0, color: colors.muted, fontSize: 14, lineHeight: 1.7 }}>{step.description}</p></article>)}</div>{industry.businessNotes && <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>{industry.businessNotes.map((note) => <div key={note} style={{ padding: "16px 18px", borderRadius: 16, background: "rgba(126,34,206,.1)", border: `1px solid ${colors.border}`, color: colors.muted, fontSize: 13, lineHeight: 1.65 }}>{note}</div>)}</div>}</div></section>}

      <section id="plans" style={{ padding: "88px 24px 104px", borderTop: `1px solid ${colors.border}`, background: "linear-gradient(180deg,#0a0414 0%,#080311 100%)" }}><div style={{ maxWidth: 1220, margin: "0 auto" }}><div style={{ maxWidth: 780, marginBottom: 34 }}><span style={{ color: colors.purpleSoft, fontSize: 11, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase" }}>Plans for {industry.name}</span><h2 style={{ margin: "12px 0", fontSize: "clamp(2.2rem,4.5vw,3.8rem)", letterSpacing: "-.05em" }}>Start simple. Add operational depth only when the business needs it.</h2><p style={{ margin: 0, color: colors.muted, lineHeight: 1.8 }}>The same four Fluxknight tiers work across industries. The workflows and database layer change to match how each organization actually operates.</p></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 18 }}>{planDefinitions.map((plan) => <article key={plan.key} style={{ padding: 24, borderRadius: 20, background: plan.key === "business" ? "linear-gradient(180deg,rgba(126,34,206,.22),rgba(18,9,31,.96))" : colors.panel, border: `1px solid ${plan.key === "business" ? colors.borderStrong : colors.border}` }}><span style={{ color: colors.purpleSoft, fontSize: 10, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase" }}>{plan.eyebrow}</span><h3 style={{ margin: "10px 0 10px", fontSize: 28, letterSpacing: "-.035em" }}>{plan.name}</h3><p style={{ margin: 0, color: colors.muted, fontSize: 14, lineHeight: 1.7 }}>{plan.summary}</p><p style={{ margin: "14px 0 0", color: colors.text, fontSize: 12, lineHeight: 1.6 }}><strong>Best for:</strong> {plan.bestFor}</p><ul style={{ margin: "20px 0 0", paddingLeft: 18, color: colors.muted, fontSize: 13, lineHeight: 1.7 }}>{plan.includes.map((item) => <li key={item} style={{ marginBottom: 7 }}>{item}</li>)}</ul>{plan.notIncluded?.map((item) => <p key={item} style={{ margin: "12px 0 0", color: "#d3c4e2", opacity: .75, fontSize: 12, lineHeight: 1.55 }}>Not included: {item.replace(/^No /, "")}</p>)}{plan.unavailable?.map((item) => <p key={item} style={{ margin: "16px 0 0", color: "#f4c27a", fontSize: 12, lineHeight: 1.55 }}>{item}</p>)}{plan.leoExplanation && <div style={{ marginTop: 16, padding: "14px 15px", borderRadius: 14, background: "rgba(255,255,255,.025)", border: `1px solid ${colors.border}` }}><strong style={{ display: "block", marginBottom: 6, fontSize: 12 }}>What Leo does</strong><p style={{ margin: 0, color: colors.muted, fontSize: 12, lineHeight: 1.6 }}>{plan.leoExplanation}</p></div>}{plan.comingSoon?.map((item) => <p key={item} style={{ margin: "16px 0 0", color: colors.purpleSoft, fontSize: 12, lineHeight: 1.55 }}>Coming soon: {item}</p>)}<PlanExample industry={industry} planKey={plan.key} /><Link href={`/pricing?plan=${encodeURIComponent(plan.key)}&industry=${encodeURIComponent(industry.slug)}#plan-details`} style={{ display: "inline-flex", marginTop: 18, color: colors.purpleSoft, fontSize: 13, fontWeight: 850, textDecoration: "none" }}>Compare this plan →</Link></article>)}</div></div></section>

      <section style={{ padding: "84px 24px 112px" }}><div style={{ maxWidth: 980, margin: "0 auto", padding: "42px 30px", borderRadius: 24, textAlign: "center", background: "radial-gradient(circle at 50% 0%,rgba(126,34,206,.24),transparent 54%),rgba(18,9,31,.92)", border: `1px solid ${colors.borderStrong}` }}><span style={{ color: colors.purpleSoft, fontSize: 11, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase" }}>{industry.databaseLabel}</span><h2 style={{ margin: "12px auto", maxWidth: 760, fontSize: "clamp(2rem,4vw,3.3rem)", letterSpacing: "-.045em" }}>Build only the level of automation your organization can actually use.</h2><p style={{ margin: "0 auto 24px", maxWidth: 700, color: colors.muted, lineHeight: 1.8 }}>We map the customer journey and operational pressure first, then recommend the smallest plan that solves the actual problem.</p><Link href={evaluationHref} style={{ display: "inline-flex", padding: "13px 22px", borderRadius: 999, color: "#fff", fontWeight: 850, textDecoration: "none", background: "linear-gradient(135deg,#a855f7,#7c3aed)" }}>Evaluate {industry.name}</Link></div></section>
    </main>
  );
}
