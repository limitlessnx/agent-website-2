import Link from "next/link";
import { ArrowRight } from "@/components/admin/ServerIcons";
import type { IndustryDefinition } from "@/lib/industryCatalog";
import styles from "./IndustryDetailPage.module.css";

export default function IndustryDetailPage({ industry }: { industry: IndustryDefinition }) {
  const evaluationHref = `/evaluation?industry=${encodeURIComponent(industry.slug)}`;
  const pricingHref = `/pricing?industry=${encodeURIComponent(industry.slug)}`;
  const previewJourney = industry.journey.slice(0, 5);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="fk-shell">
          <div className={styles.heroGrid}>
            <div>
              <Link className={styles.back} href="/industries">← All industries</Link>
              <span className={styles.eyebrow}>Fluxknight for {industry.name}</span>
              <h1>{industry.hero}</h1>
              <p className={styles.subhead}>{industry.subhead}</p>

              {industry.channels && (
                <div className={styles.channels} aria-label={`${industry.name} supported channels`}>
                  {industry.channels.map((channel) => <span className={styles.channel} key={channel}>{channel}</span>)}
                </div>
              )}

              <div className={styles.actions}>
                <Link className={styles.primary} href={evaluationHref}>Evaluate My Business <ArrowRight size={16} /></Link>
                <a className={styles.secondary} href="#workflow">See how it works</a>
              </div>
            </div>

            <div className={styles.heroVisual} aria-label={`${industry.name} customer journey preview`}>
              <div className={styles.visualHead}><strong>{industry.name} journey</strong><span className={styles.live}><i /> Connected workflow</span></div>
              <div className={styles.journeyPreview}>
                {previewJourney.map((step, index) => (
                  <div className={styles.journeyItem} key={step}>
                    <span className={styles.journeyNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{step}</strong>
                  </div>
                ))}
              </div>
              <div className={styles.visualFoot}>
                <div><b>{industry.journey.length} stages</b><span>connected journey</span></div>
                <div><b>Human handoff</b><span>when judgment matters</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="fk-shell">
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>Where automation earns its place</span>
            <h2>Remove the repetitive friction without removing human judgment.</h2>
            <p>Fluxknight is designed to take over the routine customer and operational work around the journey, while staff remain responsible for the decisions, exceptions and relationships that genuinely need a person.</p>
          </div>
          <div className={styles.twoCol}>
            <article className={styles.infoCard}>
              <span className={styles.cardLabel}>Where friction happens</span>
              <ul className={styles.list}>{industry.problem.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article className={styles.infoCard}>
              <span className={styles.cardLabel}>What improves</span>
              <ul className={styles.list}>{industry.outcomes.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <div className="fk-shell">
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>Customer journey</span>
            <h2>A clearer route from first contact to the right human action.</h2>
          </div>
          <div className={styles.journeyGrid}>
            {industry.journey.map((step, index) => (
              <div className={styles.journeyCard} key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {industry.workflowSteps && industry.workflowSteps.length > 0 && (
        <section className={styles.section} id="workflow">
          <div className="fk-shell">
            <div className={styles.sectionIntro}>
              <span className={styles.eyebrow}>How the system operates</span>
              <h2>{industry.workflowTitle}</h2>
              <p>{industry.workflowIntro}</p>
            </div>
            <div className={styles.workflowGrid}>
              {industry.workflowSteps.map((step, index) => (
                <article className={styles.workflowCard} key={step.title}>
                  <span>STEP {String(index + 1).padStart(2, "0")}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
            {industry.businessNotes && (
              <div className={styles.notes}>
                {industry.businessNotes.map((note) => <div className={styles.note} key={note}>{note}</div>)}
              </div>
            )}
          </div>
        </section>
      )}

      <section className={styles.sectionAlt} id="plans">
        <div className="fk-shell">
          <div className={styles.planCard}>
            <span className={styles.eyebrow}>Plans for {industry.name}</span>
            <h2>Use the same Fluxknight platform, scaled to the depth your operation actually needs.</h2>
            <p>Fluxknight keeps the core plan structure consistent across industries. The channels, workflow depth, integrations and operational setup are then tailored to how {industry.name} works instead of inventing a different pricing universe for every vertical. Humanity survives another pricing page.</p>
            <div className={styles.planActions}>
              <Link className={styles.primary} href={pricingHref}>View Pricing <ArrowRight size={16} /></Link>
              <Link className={styles.secondary} href={evaluationHref}>Evaluate My Business</Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="fk-shell">
          <div className={styles.twoCol}>
            <article className={styles.infoCard}>
              <span className={styles.cardLabel}>Basic → Plus</span>
              <ul className={styles.list}>
                <li>{industry.basicExample}</li>
                <li>{industry.starterExample}</li>
              </ul>
            </article>
            <article className={styles.infoCard}>
              <span className={styles.cardLabel}>Business → Business+</span>
              <ul className={styles.list}>
                <li>{industry.businessExample}</li>
                <li>{industry.businessPlusExample}</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.final}>
        <div className="fk-shell">
          <div className={styles.finalCard}>
            <span className={styles.eyebrow}>{industry.databaseLabel}</span>
            <h2>Build only the level of automation your organization can actually use.</h2>
            <p>We map the customer journey and operational pressure first, then recommend the smallest system that solves the real problem and can expand when the business is ready.</p>
            <Link className={styles.primary} href={evaluationHref}>Evaluate {industry.name} <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
