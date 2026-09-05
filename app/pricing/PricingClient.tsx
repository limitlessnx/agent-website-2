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
    <main className="quantix-home pricing-page-shell">
      <section className="brand-section pricing-page-hero">
        <div className="brand-shell">
          <div className="brand-heading pricing-page-heading">
            <span className="brand-eyebrow">Fluxknight Plans</span>
            <h1>Choose the level of automation your organization actually needs.</h1>
            <p>Basic, Starter, Business and Business+ stay consistent across industries. The workflow, channels and operational data layer change to match how each organization actually works.</p>
          </div>
        </div>
      </section>

      <section className="brand-section pricing-page-content">
        <div className="brand-shell">
          <div className="pricing-industry-box">
            <span className="brand-eyebrow">Choose your industry</span>
            <div className="pricing-industry-selector">
              <label>
                <span>See how scope changes for your operation</span>
                <select value={industrySlug} onChange={(event) => setIndustrySlug(event.target.value)}>
                  <option value="">General pricing framework</option>
                  {industries.map((industry) => <option key={industry.slug} value={industry.slug}>{industry.name}</option>)}
                </select>
              </label>
              {selectedIndustry && <Link href={`/industries/${selectedIndustry.slug}#plans`} className="button-secondary">View {selectedIndustry.name} page</Link>}
            </div>
          </div>

          <div className="pricing-plan-grid">
            {planDefinitions.map((plan) => {
              const selected = plan.key === activePlan;
              return (
                <button
                  key={plan.key}
                  type="button"
                  className={`pricing-plan-card${selected ? " is-selected" : ""}`}
                  onClick={() => {
                    setActivePlan(plan.key);
                    requestAnimationFrame(() => document.getElementById("plan-details")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                  aria-pressed={selected}
                >
                  <span className="pricing-plan-eyebrow">{plan.eyebrow}</span>
                  <h2>{plan.name}</h2>
                  <p>{plan.summary}</p>
                  <span className="pricing-plan-action">{selected ? "Selected" : "View full explanation"} <ArrowRight size={14} /></span>
                </button>
              );
            })}
          </div>

          <section id="plan-details" className="pricing-detail-panel">
            <span className="brand-eyebrow">{active.name} plan</span>
            <div className="pricing-detail-grid">
              <div className="pricing-detail-copy">
                <h2>{active.summary}</h2>
                <p><strong>Best for:</strong> {active.bestFor}</p>
                <h3>What’s included</h3>
                <div className="pricing-feature-list">
                  {active.includes.map((item) => <span key={item}><CheckCircle2 size={17} /> {item}</span>)}
                </div>
                {active.notIncluded && <div className="pricing-note-box"><strong>Deliberately not included</strong>{active.notIncluded.map((item) => <p key={item}>{item}</p>)}</div>}
                {active.leoExplanation && <div className="pricing-leo-box"><strong>Leo Admin Assistance</strong><p>{active.leoExplanation}</p></div>}
                {active.unavailable?.map((item) => <p className="pricing-warning" key={item}>{item}</p>)}
                {active.comingSoon?.map((item) => <p className="pricing-coming" key={item}>Coming soon: {item}</p>)}
              </div>

              <aside className="pricing-scope-card">
                <span>Industry-adjusted pricing</span>
                <h3>{selectedIndustry ? `${selectedIndustry.name} scope` : "Pricing follows the actual system."}</h3>
                {pricingProfile ? <>
                  <p><strong>Complexity:</strong> {pricingProfile.complexity}</p>
                  <div><strong>Typical channels</strong><p>{pricingProfile.typicalChannels.join(" · ")}</p></div>
                  <div><strong>What changes the price</strong><ul>{pricingProfile.scopeDrivers.map((driver) => <li key={driver}>{driver}</li>)}</ul></div>
                  <div className="pricing-industry-note"><strong>{active.name} for {selectedIndustry?.name}</strong><p>{pricingProfile.planNotes[active.key]}</p></div>
                </> : <p>Choose an industry above to see its pricing drivers. Exact scope depends on channels, usage, integrations, workflow depth and the operational data layer required.</p>}
                <Link href={evaluationHref} className="button-primary">Evaluate this plan <ArrowRight size={16} /></Link>
              </aside>
            </div>
          </section>

          <p className="pricing-footnote">Third-party messaging, email and provider usage may be subject to fair-use limits or additional usage charges depending on volume and provider costs.</p>
        </div>
      </section>

      <style>{`
        .pricing-page-shell{background:#080311;color:#fbf8ff}
        .pricing-page-hero{padding-top:9rem;padding-bottom:3.5rem;background:radial-gradient(circle at 50% 0%,rgba(139,92,246,.16),transparent 44%)}
        .pricing-page-heading{max-width:900px;margin:0 auto;text-align:center}
        .pricing-page-heading h1{margin:14px auto 18px;font-size:clamp(2.5rem,6vw,5rem);line-height:1;letter-spacing:-.055em}
        .pricing-page-heading p{max-width:760px;margin:0 auto;color:#aaa0bb;line-height:1.75}
        .pricing-page-content{padding-top:0}
        .pricing-industry-box{margin-bottom:28px;padding:22px;border-radius:18px;background:rgba(18,9,31,.9);border:1px solid rgba(168,85,247,.22)}
        .pricing-industry-selector{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end;margin-top:12px}
        .pricing-industry-selector label{display:grid;gap:8px;min-width:0}
        .pricing-industry-selector label>span{color:#aaa0bb;font-size:13px}
        .pricing-industry-selector select{width:100%;min-height:48px;padding:12px 14px;border-radius:12px;color:#fbf8ff;background:#12091f;border:1px solid rgba(168,85,247,.32)}
        .pricing-plan-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
        .pricing-plan-card{display:block!important;width:100%;min-width:0;min-height:300px;padding:24px!important;text-align:left!important;cursor:pointer;border-radius:20px!important;color:#fbf8ff!important;background:rgba(18,9,31,.9)!important;border:1px solid rgba(168,85,247,.22)!important;box-shadow:none!important;overflow:hidden}
        .pricing-plan-card.is-selected{background:linear-gradient(180deg,rgba(126,34,206,.25),rgba(18,9,31,.96))!important;border-color:rgba(192,132,252,.5)!important;box-shadow:0 22px 60px rgba(86,33,160,.14)!important}
        .pricing-plan-eyebrow{display:block;color:#d8b4fe;font-size:10px;font-weight:850;line-height:1.3;letter-spacing:.13em;text-transform:uppercase}
        .pricing-plan-card h2{display:block;margin:14px 0 12px!important;font-size:30px!important;line-height:1.05!important;letter-spacing:-.035em!important;color:#fbf8ff!important}
        .pricing-plan-card p{display:block;margin:0!important;color:#aaa0bb!important;font-size:14px!important;line-height:1.7!important;overflow-wrap:normal!important;word-break:normal!important}
        .pricing-plan-action{display:inline-flex;align-items:center;gap:6px;margin-top:22px;color:#d8b4fe;font-size:13px;font-weight:850}
        .pricing-detail-panel{scroll-margin-top:110px;margin-top:28px;padding:clamp(24px,4vw,40px);border-radius:24px;background:rgba(18,9,31,.94);border:1px solid rgba(192,132,252,.36)}
        .pricing-detail-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:32px;align-items:start;margin-top:12px}
        .pricing-detail-copy h2{margin:0 0 16px;font-size:clamp(2.1rem,4vw,3.4rem);line-height:1.04;letter-spacing:-.045em}
        .pricing-detail-copy>p{color:#aaa0bb;line-height:1.8}.pricing-detail-copy>p strong{color:#fbf8ff}.pricing-detail-copy h3{margin-top:28px}
        .pricing-feature-list{display:grid;gap:10px;margin-top:14px}.pricing-feature-list span{display:flex;gap:9px;align-items:flex-start;color:#aaa0bb;line-height:1.5}.pricing-feature-list svg{flex:0 0 auto;color:#c084fc;margin-top:2px}
        .pricing-note-box,.pricing-leo-box{margin-top:24px;padding:18px;border-radius:16px;border:1px solid rgba(168,85,247,.18)}.pricing-note-box{background:rgba(255,255,255,.025)}.pricing-leo-box{background:rgba(126,34,206,.1);border-color:rgba(168,85,247,.24)}.pricing-note-box strong,.pricing-leo-box strong{display:block;margin-bottom:8px}.pricing-note-box p,.pricing-leo-box p{margin:5px 0;color:#aaa0bb;font-size:13px;line-height:1.65}
        .pricing-warning{margin-top:20px!important;color:#f4c27a!important;font-size:13px}.pricing-coming{margin-top:20px!important;color:#d8b4fe!important;font-size:13px}
        .pricing-scope-card{padding:24px;border-radius:20px;background:rgba(255,255,255,.025);border:1px solid rgba(168,85,247,.2)}.pricing-scope-card>span{display:block;color:#d8b4fe;font-size:11px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.pricing-scope-card h3{margin:10px 0;font-size:26px}.pricing-scope-card p{margin:0;color:#aaa0bb;line-height:1.7;font-size:14px}.pricing-scope-card>div{margin-top:16px}.pricing-scope-card>div>strong{display:block;margin-bottom:8px;font-size:13px}.pricing-scope-card ul{margin:0;padding-left:18px;color:#aaa0bb;font-size:13px;line-height:1.7}.pricing-industry-note{padding:14px;border-radius:14px;background:rgba(126,34,206,.1);border:1px solid rgba(168,85,247,.22)}.pricing-industry-note p{font-size:13px!important;line-height:1.65!important}.pricing-scope-card .button-primary{margin-top:22px}
        .pricing-footnote{opacity:.65;margin-top:2.5rem;font-size:13px;line-height:1.6}
        @media(max-width:980px){.pricing-plan-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pricing-detail-grid{grid-template-columns:1fr}.pricing-plan-card{min-height:260px}}
        @media(max-width:780px){.pricing-page-hero{padding-top:7.5rem;padding-bottom:2.5rem}.pricing-page-heading{text-align:left}.pricing-page-heading h1{font-size:clamp(2.2rem,10vw,3.4rem)}.pricing-industry-selector{grid-template-columns:1fr}.pricing-plan-grid{grid-template-columns:1fr;gap:12px}.pricing-plan-card{min-height:0;padding:20px!important;border-radius:18px!important}.pricing-plan-card h2{font-size:2rem!important;margin:10px 0 9px!important}.pricing-plan-card p{font-size:.9rem!important;line-height:1.58!important}.pricing-plan-action{margin-top:16px}.pricing-detail-panel{padding:20px 16px;border-radius:20px}.pricing-detail-copy h2{font-size:2rem}.pricing-scope-card{padding:18px}.pricing-industry-box{padding:18px}}
      `}</style>
    </main>
  );
}
