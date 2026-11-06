import Link from "next/link";
import { ArrowRight, MessageSquareText, CalendarCheck2, UsersRound, Workflow } from "lucide-react";
import styles from "./ProductLedHero.module.css";

const steps = [
  { title: "New enquiry", detail: "Customer reaches your business", Icon: MessageSquareText },
  { title: "Maia responds", detail: "Answers questions and captures intent", Icon: UsersRound },
  { title: "Next action", detail: "Booking, follow-up or human handoff", Icon: CalendarCheck2 },
];

export default function ProductLedHero() {
  return (
    <section className={styles.hero} aria-labelledby="product-hero-title">
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}><span className={styles.statusDot} /> The AI business operations platform</span>
          <h1 id="product-hero-title">Your business.<br /><span>Running on AI.</span></h1>
          <p>One connected place for customer conversations, lead management, follow-ups and the work that moves your business forward.</p>
          <div className={styles.actions}>
            <Link href="/evaluation" className={styles.primary} data-cta="product-hero-evaluation">Evaluate My Business <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link href="/industries" className={styles.secondary}>Explore industries <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          <p className={styles.support}>Built around how your organization works, from real estate to service businesses.</p>
        </div>
        <div className={styles.preview} aria-label="Illustrative Fluxknight customer journey preview">
          <div className={styles.previewTop}>
            <div className={styles.previewIdentity}><span className={styles.previewMark}><Workflow size={18} aria-hidden="true" /></span><span><strong>Connected customer journey</strong><small>Illustrative workflow preview</small></span></div>
            <span className={styles.previewTag}>DEMO</span>
          </div>
          <div className={styles.flow}>
            {steps.map(({ title, detail, Icon }, index) => (
              <div className={styles.step} key={title}>
                <div className={styles.stepIcon}><Icon size={20} aria-hidden="true" /></div>
                <div className={styles.stepText}><span>0{index + 1}</span><strong>{title}</strong><small>{detail}</small></div>
                {index < steps.length - 1 && <div className={styles.connector} aria-hidden="true" />}
              </div>
            ))}
          </div>
          <div className={styles.previewBottom}><span className={styles.pulse} /> Keep the context. Move the customer forward.</div>
        </div>
      </div>
      <div className={styles.bottomBar}>
        <span>One connected workflow</span><span>Customer conversations</span><span>CRM &amp; follow-ups</span><span>Human oversight</span>
      </div>
    </section>
  );
}
