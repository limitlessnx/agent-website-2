"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "@/components/admin/ServerIcons";
import { industries, planDefinitions, type PlanKey } from "@/lib/industryCatalog";
import { industryPricingBySlug } from "@/lib/industryPricing";

const planOrder: PlanKey[] = ["basic", "starter", "business", "business-plus"];

export default function PricingClient() {
  const [activePlan, setActivePlan] = useState<PlanKey>("basic");
  const [industrySlug, setIndustrySlug] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("plan") as PlanKey | null;
    const requestedIndustry = params.get("industry") || "";
    if (requested && planOrder.includes(requested)) setActivePlan(requested);
    if (requestedIndustry) setIndustrySlug(requestedIndustry);
  }, []);

  const active = planDefinitions.find((plan) => plan.key === activePlan) ?? planDefinitions[0];
  const selectedIndustry = industries.find((industry) => industry.slug === industrySlug);
  const pricingProfile = industrySlug ? industryPricingBySlug[industrySlug] : undefined;
  const evaluationHref = `/evaluation?plan=${encodeURIComponent(active.key)}${industrySlug ? `&industry=${encodeURIComponent(industrySlug)}` : ""}`;

  return (
    <main className="quantix-home">
      <section className="brand-section" style={{ paddingTop: "9rem" }}>
        <div className="brand-shell"><div className="brand-heading"><span className="brand-eyebrow">Fluxknight Plans</span><h1 style={{ fontSize: "clamp(2.5rem,6vw,5rem)", lineHeight: 1 }}>Start with the level of automation your organization actually needs.</h1><p>Basic, Starter, Business and Business+ stay consistent across industries. Final pricing changes with the channels, usage, workflow depth, integrations and operational layer required.</p></div></div>
      </section>

      <section className="brand-section" style={{ paddingTop: 0 }}><div className="brand-shell">
        <div style={{ marginBottom: 28, padding: 22, borderRadius: 18, background: "rgba(18,9,31,.9)", border: "1px solid rgba(168,85,247,.22)" }}>
          <span className="brand-eyebrow">Choose your industry</span>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "end" }} className="pricing-industry-selector">
            <label style={{ display: "grid", gap: 8 }}><span style={{ color: "#aaa0bb", fontSize: 13 }}>See how scope changes for your operation</span><select value={industrySlug} onChange={(event) => setIndustrySlug(event.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, color: "#fbf8ff", background: "#12091f", border: "1px solid rgba(168,85,247,.32)" }}><option value="">General pricing framework</option>{industries.map((industry) => <option key={industry.slug} value={industry.slug}>{industry.name}</option>)}</select></label>
            {selectedIndustry && <Link href={`/industries/${selectedIndustry.slug}#plans`} className="button-secondary">View {selectedIndustry.name} page</Link>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>{planDefinitions.map((plan) => { const selected = plan.key === activePlan; return <button key={plan.key} type="button" onClick={() => { setActivePlan(plan.key); requestAnimationFrame(() => document.getElementById("plan-details")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} aria-pressed={selected} style={{ textAlign: "left", cursor: "pointer", padding: 24, borderRadius: 20, color: "#fbf8ff", background: selected ? "linear-gradient(180deg,rgba(126,34,206,.25),rgba(18,9,31,.96))" : "rgba(18,9,31,.9)", border: selected ? "1px solid rgba(192,132,252,.5)" : "1px solid rgba(168,85,247,.22)" }}><span style={{ display: "block", color: "#d8b4fe", fontSize: 10, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase" }}>{plan.eyebrow}</span><h2 style={{ margin: "10px 0", fontSize: 30 }}>{plan.name}</h2><p style={{ margin: 0, color: "#aaa0bb", fontSize: 14, lineHeight: 1.7 }}>{plan.summary}</p><span style={{ display: "inline-flex", marginTop: 18, color: "#d8b4fe", fontSize: 13, fontWeight: 850 }}>{selected ? "Selected" : "View full explanation"} →</span></button>; })}</div>

        <section id="plan-details" style={{ scrollMarginTop: 110, marginTop: 28, padding: "clamp(24px,4vw,40px)", borderRadius: 24, background: "rgba(18,9,31,.94)", border: "1px solid rgba(192,132,252,.36)" }}>
          <span className="brand-eyebrow">{active.name} plan</span>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(280px,.95fr)", gap: 32, alignItems: "start" }} className="pricing-detail-grid">
            <div><h2 style={{ margin: "12px 0", fontSize: "clamp(2.1rem,4vw,3.4rem)", letterSpacing: "-.045em" }}>{active.summary}</h2><p style={{ color: "#aaa0bb", lineHeight: 1.8 }}><strong style={{ color: "#fbf8ff" }}>Best for:</strong> {active.bestFor}</p><h3 style={{ marginTop: 28 }}>What’s included</h3><div style={{ display: "grid", gap: 10, marginTop: 14 }}>{active.includes.map((item) => <span key={item} style={{ display: "flex", gap: 9, alignItems: "flex-start", color: "#aaa0bb" }}><CheckCircle2 size={17} /> {item}</span>)}</div>{active.notIncluded && <div style={{ marginTop: 24, padding: 18, borderRadius: 16, background: "rgba(255,255,255,.025)", border: "1px solid rgba(168,85,247,.18)" }}><strong style={{ display: "block", marginBottom: 8 }}>Deliberately not included</strong>{active.notIncluded.map((item) => <p key={item} style={{ margin: "5px 0", color: "#aaa0bb", fontSize: 13 }}>{item}</p>)}</div>}{active.leoExplanation && <div style={{ marginTop: 24, padding: 20, borderRadius: 16, background: "rgba(126,34,206,.1)", border: "1px solid rgba(168,85,247,.24)" }}><strong style={{ display: "block", marginBottom: 8 }}>Leo Admin Assistance</strong><p style={{ margin: 0, color: "#aaa0bb", lineHeight: 1.7 }}>{active.leoExplanation}</p></div>}{active.unavailable?.map((item) => <p key={item} style={{ marginTop: 20, color: "#f4c27a", fontSize: 13 }}>{item}</p>)}{active.comingSoon?.map((item) => <p key={item} style={{ marginTop: 20, color: "#d8b4fe", fontSize: 13 }}>Coming soon: {item}</p>)}</div>

            <aside style={{ padding: 24, borderRadius: 20, background: "rgba(255,255,255,.025)", border: "1px solid rgba(168,85,247,.2)" }}><span style={{ display: "block", color: "#d8b4fe", fontSize: 11, fontWeight: 850, letterSpacing: ".12em", textTransform: "uppercase" }}>Industry-adjusted pricing</span><h3 style={{ margin: "10px 0", fontSize: 26 }}>{selectedIndustry ? `${selectedIndustry.name} scope` : "Pricing follows the actual system."}</h3>{pricingProfile ? <><p style={{ margin: 0, color: "#aaa0bb", lineHeight: 1.7, fontSize: 14 }}><strong style={{ color: "#fbf8ff" }}>Complexity:</strong> {pricingProfile.complexity}</p><div style={{ marginTop: 16 }}><strong style={{ display: "block", marginBottom: 8, fontSize: 13 }}>Typical channels</strong><p style={{ margin: 0, color: "#aaa0bb", lineHeight: 1.65, fontSize: 13 }}>{pricingProfile.typicalChannels.join(" · ")}</p></div><div style={{ marginTop: 16 }}><strong style={{ display: "block", marginBottom: 8, fontSize: 13 }}>What changes the price</strong><ul style={{ margin: 0, paddingLeft: 18, color: "#aaa0bb", fontSize: 13, lineHeight: 1.7 }}>{pricingProfile.scopeDrivers.map((driver) => <li key={driver}>{driver}</li>)}</ul></div><div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: "rgba(126,34,206,.1)", border: "1px solid rgba(168,85,247,.22)" }}><strong style={{ display: "block", marginBottom: 6 }}>{active.name} for {selectedIndustry?.name}</strong><p style={{ margin: 0, color: "#aaa0bb", fontSize: 13, lineHeight: 1.65 }}>{pricingProfile.planNotes[active.key]}</p></div></> : <p style={{ margin: 0, color: "#aaa0bb", lineHeight: 1.75, fontSize: 14 }}>Choose an industry above to see its pricing drivers. Exact amounts will be locked by market and deployment scope rather than forcing every organization into the same usage assumptions.</p>}<Link href={evaluationHref} className="button-primary" style={{ marginTop: 22 }}>Evaluate this plan <ArrowRight size={16} /></Link></aside>
          </div>
        </section>

        <p style={{ opacity: .65, marginTop: "2.5rem", fontSize: 13 }}>Third-party voice, messaging, email and provider usage may be subject to fair-use limits or additional usage charges depending on volume and provider costs.</p>
      </div></section>
      <style>{`@media (max-width: 780px) { .pricing-detail-grid,.pricing-industry-selector { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  );
}
