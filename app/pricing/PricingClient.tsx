"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "@/components/admin/ServerIcons";
import { industries, planDefinitions, type PlanKey } from "@/lib/industryCatalog";
import { industryPricingBySlug } from "@/lib/industryPricing";
import { calculatePrepaidPrice, isPrepaidTerm, PREPAID_TERMS, type PrepaidTerm } from "@/lib/payments/terms";
import { usePublicPricing } from "@/lib/use-public-pricing";

const planOrder: PlanKey[] = ["basic", "starter", "business", "business-plus"];
const checkoutSlugByPlan: Record<PlanKey, string> = {
  basic: "whatsapp-ai-starter",
  starter: "ai-call-receptionist",
  business: "ai-front-desk-suite",
  "business-plus": "custom-ai-operations",
};
type BillingTerm = "monthly" | PrepaidTerm;

function normalizeRequestedPlan(value: string | null): PlanKey | null {
  if (value === "plus") return "starter";
  return value as PlanKey | null;
}

function money(value: number, currency: "NGN" | "USD") {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PricingClient() {
  const [activePlan, setActivePlan] = useState<PlanKey>("basic");
  const [industrySlug, setIndustrySlug] = useState("");
  const [billingTerm, setBillingTerm] = useState<BillingTerm>("monthly");
  const {
    prices,
    currency,
    canViewInternational,
    viewingInternational,
    showInternational,
    showNigeria,
  } = usePublicPricing();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = normalizeRequestedPlan(params.get("plan"));
    const requestedIndustry = params.get("industry") || "";
    const requestedTerm = params.get("term");
    if (requested && planOrder.includes(requested)) setActivePlan(requested);
    if (requestedIndustry) setIndustrySlug(requestedIndustry);
    if (isPrepaidTerm(requestedTerm)) setBillingTerm(requestedTerm);
  }, []);

  const active = planDefinitions.find((plan) => plan.key === activePlan) ?? planDefinitions[0];
  const selectedIndustry = industries.find((industry) => industry.slug === industrySlug);
  const pricingProfile = industrySlug ? industryPricingBySlug[industrySlug] : undefined;
  const activePrice = prices[active.key];
  const prepaidPrice = billingTerm !== "monthly" && activePrice && !activePrice.custom
    ? calculatePrepaidPrice(activePrice.installationFee, activePrice.recurringFee, billingTerm)
    : null;
  const checkoutSlug = activePrice?.slug ?? checkoutSlugByPlan[active.key];
  const checkoutHref = `/checkout?plan=${encodeURIComponent(checkoutSlug)}${billingTerm === "monthly" ? "" : `&term=${encodeURIComponent(billingTerm)}`}`;
  const planCtaLabel = prepaidPrice && activePrice
    ? `Prepay ${money(prepaidPrice.total, activePrice.currency)}`
    : "Continue to checkout";
  const customHref = `/evaluation?plan=custom${industrySlug ? `&industry=${encodeURIComponent(industrySlug)}` : ""}`;

  return (
    <main className="quantix-home pricing-page-shell">
      <section className="brand-section pricing-page-hero">
        <div className="brand-shell">
          <div className="brand-heading pricing-page-heading">
            <span className="brand-eyebrow">Fluxknight Plans</span>
            <h1>Choose the level of automation your organization actually needs.</h1>
            <p>Basic, Plus, Business and Business+ have defined package scopes. Custom is for anything outside those packages that a client needs automated, integrated or set up.</p>
            {canViewInternational ? (
              <div className="pricing-region-switch" aria-label="Choose pricing view">
                <button type="button" className={!viewingInternational ? "is-active" : ""} onClick={showNigeria}>Nigeria</button>
                <button type="button" className={viewingInternational ? "is-active" : ""} onClick={showInternational}>International</button>
              </div>
            ) : null}
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
              const planPrice = prices[plan.key];
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
                  {planPrice ? <div className="pricing-plan-mini-price"><strong>{planPrice.first}</strong><span> + {planPrice.ongoing}</span></div> : null}
                  <p>{plan.summary}</p>
                  <span className="pricing-plan-action">{selected ? "Selected" : "View full explanation"} <ArrowRight size={14} /></span>
                </button>
              );
            })}
            <Link href={customHref} className="pricing-plan-card pricing-custom-card">
              <span className="pricing-plan-eyebrow">Built around your requirements</span>
              <h2>Custom</h2>
              <div className="pricing-plan-mini-price"><strong>Custom scope</strong><span>Pricing based on requirements</span></div>
              <p>Anything the client needs automated, integrated or set up, including custom agents, workflows, databases, internal tools, integrations, dashboards and operational systems.</p>
              <span className="pricing-plan-action">Build a Custom plan <ArrowRight size={14} /></span>
            </Link>
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
                <span>{currency ? `Pricing in ${currency}` : "Fluxknight pricing"}</span>
                {activePrice ? (
                  <div className="pricing-current-price">
                    <div><small>Implementation</small><strong>{activePrice.first}</strong></div>
                    <div><small>Monthly renewal</small><strong>{activePrice.ongoing}</strong></div>
                  </div>
                ) : null}

                {activePrice && !activePrice.custom ? (
                  <div className="pricing-term-box">
                    <strong>Billing duration</strong>
                    <div className="pricing-term-switch" aria-label="Choose billing duration">
                      <button type="button" className={billingTerm === "monthly" ? "is-active" : ""} onClick={() => setBillingTerm("monthly")}>Monthly<small>Standard</small></button>
                      {(Object.keys(PREPAID_TERMS) as PrepaidTerm[]).map((key) => {
                        const option = PREPAID_TERMS[key];
                        return <button key={key} type="button" className={billingTerm === key ? "is-active" : ""} onClick={() => setBillingTerm(key)}>{option.label}<small>Save {option.discountPercent}%</small></button>;
                      })}
                    </div>
                    {prepaidPrice ? (
                      <div className="pricing-term-total">
                        <small>{prepaidPrice.label} prepaid total</small>
                        <strong>{money(prepaidPrice.total, activePrice.currency)}</strong>
                        <span>You save {money(prepaidPrice.discount, activePrice.currency)} from {money(prepaidPrice.subtotal, activePrice.currency)}</span>
                      </div>
                    ) : (
                      <div className="pricing-term-total">
                        <small>Monthly option</small>
                        <strong>{activePrice.first}</strong>
                        <span>Implementation is paid at checkout. Monthly renewal continues at {activePrice.ongoing}.</span>
                      </div>
                    )}
                  </div>
                ) : null}

                <h3>{selectedIndustry ? `${selectedIndustry.name} scope` : "Pricing follows the actual system."}</h3>
                {pricingProfile ? <>
                  <p><strong>Complexity:</strong> {pricingProfile.complexity}</p>
                  <div><strong>Typical channels</strong><p>{pricingProfile.typicalChannels.join(" · ")}</p></div>
                  <div><strong>What changes the price</strong><ul>{pricingProfile.scopeDrivers.map((driver) => <li key={driver}>{driver}</li>)}</ul></div>
                  <div className="pricing-industry-note"><strong>{active.name} for {selectedIndustry?.name}</strong><p>{pricingProfile.planNotes[active.key]}</p></div>
                </> : <p>Choose an industry above to see its pricing drivers. Exact scope depends on channels, usage, integrations, workflow depth and the operational data layer required.</p>}
                <Link href={checkoutHref} className="button-primary">{planCtaLabel} <ArrowRight size={16} /></Link>
              </aside>
            </div>
          </section>

          <p className="pricing-footnote">Prepaid discounts apply to the implementation plus the selected prepaid renewal period. Custom work is scoped separately. Third-party messaging, email and provider usage may still be subject to fair-use limits or additional usage charges depending on volume and provider costs.</p>
        </div>
      </section>

      <style>{`
        .pricing-page-shell{background:#080311;color:#fbf8ff}
        .pricing-page-hero{padding-top:9rem;padding-bottom:3.5rem;background:radial-gradient(circle at 50% 0%,rgba(139,92,246,.16),transparent 44%)}
        .pricing-page-heading{max-width:900px;margin:0 auto;text-align:center}
        .pricing-page-heading h1{margin:14px auto 18px;font-size:clamp(2.5rem,6vw,5rem);line-height:1;letter-spacing:-.055em}
        .pricing-page-heading p{max-width:760px;margin:0 auto;color:#aaa0bb;line-height:1.75}
        .pricing-region-switch{display:inline-flex;margin-top:18px;padding:4px;border:1px solid rgba(192,132,252,.2);border-radius:999px;background:rgba(255,255,255,.03)}
        .pricing-region-switch button{min-height:32px;padding:6px 12px;border:0;border-radius:999px;color:#8f829f;background:transparent;font-size:12px;font-weight:800;cursor:pointer}
        .pricing-region-switch button.is-active{color:#fff;background:rgba(139,92,246,.34)}
        .pricing-page-content{padding-top:0}
        .pricing-industry-box{margin-bottom:28px;padding:22px;border-radius:18px;background:rgba(18,9,31,.9);border:1px solid rgba(168,85,247,.22)}
        .pricing-industry-selector{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end;margin-top:12px}
        .pricing-industry-selector label{display:grid;gap:8px;min-width:0}
        .pricing-industry-selector label>span{color:#aaa0bb;font-size:13px}
        .pricing-industry-selector select{width:100%;min-height:48px;padding:12px 14px;border-radius:12px;color:#fbf8ff;background:#12091f;border:1px solid rgba(168,85,247,.32)}
        .pricing-plan-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
        .pricing-plan-card{display:block!important;width:100%;min-width:0;min-height:320px;padding:24px!important;text-align:left!important;cursor:pointer;border-radius:20px!important;color:#fbf8ff!important;background:rgba(18,9,31,.9)!important;border:1px solid rgba(168,85,247,.22)!important;box-shadow:none!important;overflow:hidden;text-decoration:none!important}
        .pricing-plan-card.is-selected{background:linear-gradient(180deg,rgba(126,34,206,.25),rgba(18,9,31,.96))!important;border-color:rgba(192,132,252,.5)!important;box-shadow:0 22px 60px rgba(86,33,160,.14)!important}
        .pricing-custom-card{background:linear-gradient(180deg,rgba(75,36,116,.2),rgba(18,9,31,.96))!important;border-style:dashed!important}
        .pricing-plan-eyebrow{display:block;color:#d8b4fe;font-size:10px;font-weight:850;line-height:1.3;letter-spacing:.13em;text-transform:uppercase}
        .pricing-plan-card h2{display:block;margin:14px 0 8px!important;font-size:30px!important;line-height:1.05!important;letter-spacing:-.035em!important;color:#fbf8ff!important}
        .pricing-plan-mini-price{margin-bottom:12px;color:#d8b4fe}.pricing-plan-mini-price strong{display:block;font-size:17px}.pricing-plan-mini-price span{display:block;margin-top:3px;font-size:11px;color:#8f829f}
        .pricing-plan-card p{display:block;margin:0!important;color:#aaa0bb!important;font-size:14px!important;line-height:1.7!important;overflow-wrap:normal!important;word-break:normal!important}
        .pricing-plan-action{display:inline-flex;align-items:center;gap:6px;margin-top:22px;color:#d8b4fe;font-size:13px;font-weight:850}
        .pricing-detail-panel{scroll-margin-top:110px;margin-top:28px;padding:clamp(24px,4vw,40px);border-radius:24px;background:rgba(18,9,31,.94);border:1px solid rgba(192,132,252,.36)}
        .pricing-detail-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:32px;align-items:start;margin-top:12px}
        .pricing-detail-copy h2{margin:0 0 16px;font-size:clamp(2.1rem,4vw,3.4rem);line-height:1.04;letter-spacing:-.045em}
        .pricing-detail-copy>p{color:#aaa0bb;line-height:1.8}.pricing-detail-copy>p strong{color:#fbf8ff}.pricing-detail-copy h3{margin-top:28px}
        .pricing-feature-list{display:grid;gap:10px;margin-top:14px}.pricing-feature-list span{display:flex;gap:9px;align-items:flex-start;color:#aaa0bb;line-height:1.5}.pricing-feature-list svg{flex:0 0 auto;color:#c084fc;margin-top:2px}
        .pricing-note-box,.pricing-leo-box{margin-top:24px;padding:18px;border-radius:16px;border:1px solid rgba(168,85,247,.18)}.pricing-note-box{background:rgba(255,255,255,.025)}.pricing-leo-box{background:rgba(126,34,206,.1);border-color:rgba(168,85,247,.24)}.pricing-note-box strong,.pricing-leo-box strong{display:block;margin-bottom:8px}.pricing-note-box p,.pricing-leo-box p{margin:5px 0;color:#aaa0bb;font-size:13px;line-height:1.65}
        .pricing-warning{margin-top:20px!important;color:#f4c27a!important;font-size:13px}.pricing-coming{margin-top:20px!important;color:#d8b4fe!important;font-size:13px}
        .pricing-scope-card{padding:24px;border-radius:20px;background:rgba(255,255,255,.025);border:1px solid rgba(168,85,247,.2)}.pricing-scope-card>span{display:block;color:#d8b4fe;font-size:11px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.pricing-current-price{display:grid;gap:12px;margin:14px 0 20px;padding:16px;border-radius:14px;background:rgba(139,92,246,.08);border:1px solid rgba(168,85,247,.2)}.pricing-current-price small{display:block;color:#8f829f;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.pricing-current-price strong{display:block;margin-top:4px;font-size:22px;color:#fff}.pricing-scope-card h3{margin:10px 0;font-size:26px}.pricing-scope-card p{margin:0;color:#aaa0bb;line-height:1.7;font-size:14px}.pricing-scope-card>div{margin-top:16px}.pricing-scope-card>div>strong{display:block;margin-bottom:8px;font-size:13px}.pricing-scope-card ul{margin:0;padding-left:18px;color:#aaa0bb;font-size:13px;line-height:1.7}.pricing-industry-note{padding:14px;border-radius:14px;background:rgba(126,34,206,.1);border:1px solid rgba(168,85,247,.22)}.pricing-industry-note p{font-size:13px!important;line-height:1.65!important}.pricing-scope-card .button-primary{margin-top:22px}
        .pricing-term-box{padding:16px;border-radius:14px;background:rgba(255,255,255,.02);border:1px solid rgba(168,85,247,.2)}.pricing-term-switch{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px!important}.pricing-term-switch button{min-width:0;padding:10px 6px;border-radius:10px;border:1px solid rgba(168,85,247,.22);background:rgba(255,255,255,.025);color:#fbf8ff;font-size:11px;font-weight:800;cursor:pointer}.pricing-term-switch button small{display:block;margin-top:3px;color:#c084fc;font-size:9px}.pricing-term-switch button.is-active{border-color:rgba(192,132,252,.75);background:rgba(126,34,206,.22)}.pricing-term-total{margin-top:12px!important;padding:14px;border-radius:12px;background:rgba(139,92,246,.08);border:1px solid rgba(168,85,247,.2)}.pricing-term-total small{display:block;color:#8f829f;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.pricing-term-total strong{display:block;margin-top:4px;color:#fff;font-size:22px}.pricing-term-total span{display:block;margin-top:4px;color:#d8b4fe;font-size:11px;line-height:1.5}
        .pricing-footnote{opacity:.65;margin-top:2.5rem;font-size:13px;line-height:1.6}
        @media(max-width:1200px){.pricing-plan-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:980px){.pricing-plan-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pricing-detail-grid{grid-template-columns:1fr}.pricing-plan-card{min-height:280px}}
        @media(max-width:780px){.pricing-page-hero{padding-top:7.5rem;padding-bottom:2.5rem}.pricing-page-heading{text-align:left}.pricing-page-heading h1{font-size:clamp(2.2rem,10vw,3.4rem)}.pricing-industry-selector{grid-template-columns:1fr}.pricing-plan-grid{grid-template-columns:1fr;gap:12px}.pricing-plan-card{min-height:0;padding:20px!important;border-radius:18px!important}.pricing-plan-card h2{font-size:2rem!important;margin:10px 0 7px!important}.pricing-plan-card p{font-size:.9rem!important;line-height:1.58!important}.pricing-plan-action{margin-top:16px}.pricing-detail-panel{padding:20px 16px;border-radius:20px}.pricing-detail-copy h2{font-size:2rem}.pricing-scope-card{padding:18px}.pricing-industry-box{padding:18px}.pricing-term-switch{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>
    </main>
  );
}
