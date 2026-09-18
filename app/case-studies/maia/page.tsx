import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "@/components/admin/ServerIcons";
import {
  AppointmentVisual,
  AudienceVisual,
  CaptureVisual,
  FollowUpVisual,
  HandoffVisual,
  HeroSystemVisual,
  InstallmentVisual,
  MarketingLeakVisual,
  OperatingSystemRevealVisual,
  PropertyMatchVisual,
  QualificationVisual,
} from "@/components/case-study/MaiaCaseStudyVisuals";
import styles from "./page.module.css";

const description = "See how Maia connects real-estate marketing, customer conversations, CRM, follow-up, property discovery, viewing workflows and human handoff in one operating system.";

export const metadata: Metadata = {
  title: "Maia Real Estate Operating System | Fluxknight",
  description,
  alternates: { canonical: "/case-studies/maia" },
};

const chapterNav = [
  ["01", "Capture", "Turn attention into identifiable customer opportunities."],
  ["02", "Understand", "Turn conversation into useful sales intelligence."],
  ["03", "Nurture", "Keep context, follow-up and launch communication moving."],
  ["04", "Convert & operate", "Move qualified intent toward the human sales team."],
];

function ChapterHeading({
  number,
  eyebrow,
  title,
  text,
}: {
  number: string;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.chapterHeading}>
      <div className={styles.chapterNumber}>{number}</div>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <p>{text}</p>
    </div>
  );
}

export default function MaiaCaseStudyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Case study · Maia for real estate</span>
              <h1>From property interest <span>to organized action.</span></h1>
              <p>Maia connects marketing, customer conversations, CRM, follow-up, property discovery, viewing workflows and human handoff so the sales team does not have to manually rebuild the same customer journey every day.</p>
              <div className={styles.actions}>
                <Link className={styles.primary} href="/pricing">See pricing <ArrowRight size={17} /></Link>
                <a className={styles.secondary} href="#story">See the journey</a>
              </div>
              <div className={styles.heroBenefits}>
                <span><CheckCircle2 size={14} /> 24/7 first response</span>
                <span><CheckCircle2 size={14} /> Context stored in CRM</span>
                <span><CheckCircle2 size={14} /> Human handoff with history</span>
              </div>
              <p className={styles.demoNote}>Illustrative buyer journey. Product capabilities shown only where configured and supported by the connected business data.</p>
            </div>
            <HeroSystemVisual />
          </div>
        </div>
      </section>

      <section className={styles.chapterRail} id="story">
        <div className={styles.shell}>
          <div className={styles.chapterRailGrid}>
            {chapterNav.map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.storySection}>
        <div className={styles.shell}>
          <div className={styles.problemIntro}>
            <span className={styles.eyebrow}>The leak</span>
            <h2>Marketing creates attention. Most businesses lose what happens next.</h2>
            <p>Ads, posts and launch campaigns can generate real interest, but without a system the enquiry, context and next action often disappear into inboxes, staff memory and disconnected spreadsheets.</p>
          </div>
          <MarketingLeakVisual />
        </div>
      </section>

      <section className={styles.chapterSection}>
        <div className={styles.shell}>
          <ChapterHeading
            number="01"
            eyebrow="Capture"
            title="Turn attention into an identifiable customer opportunity."
            text="The story starts before Maia replies. A campaign creates interest, the prospect chooses a trackable path, and Maia turns that interaction into a lead the business can actually work with."
          />
          <div className={styles.storyStack}>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Campaign → conversation</span><h3>Move interested prospects into a trackable interaction.</h3><p>Instead of treating every like as a CRM contact, the system uses supported paths such as WhatsApp, web chat or lead forms to turn campaign interest into an identifiable enquiry.</p></div>
              <CaptureVisual />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.chapterSectionAlt}>
        <div className={styles.shell}>
          <ChapterHeading
            number="02"
            eyebrow="Understand"
            title="Turn conversation into useful sales intelligence."
            text="Maia does not just answer. The useful parts of the conversation become structured context that the business can keep, search and act on."
          />
          <div className={styles.storyStack}>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Qualification</span><h3>Ask naturally. Save structurally.</h3><p>Budget, location, property type, purpose, timeline and payment preference are captured as the conversation progresses instead of forcing the prospect through a cold intake form.</p></div>
              <QualificationVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Property discovery</span><h3>Use the same context to recommend relevant properties.</h3><p>Where configured catalogue data supports it, Maia can surface matching properties and answer follow-up questions without losing what the buyer already said.</p></div>
              <PropertyMatchVisual />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.chapterSection}>
        <div className={styles.shell}>
          <ChapterHeading
            number="03"
            eyebrow="Nurture"
            title="A lead does not disappear when the conversation stops."
            text="This is the difference between a reply bot and an operating system. Maia keeps the customer context, the next action and the relevant commercial moment connected over time."
          />
          <div className={styles.storyStack}>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Contextual follow-up</span><h3>Follow up with memory, not generic chasing.</h3><p>When a prospect goes quiet, the follow-up can reference the property, launch or preference that created the original interest.</p></div>
              <FollowUpVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Launch audience</span><h3>Build a reusable customer audience from real conversations.</h3><p>Relevant leads can be grouped by interest, stage, budget band or payment preference so approved launch and promotion updates reach the people who actually asked for them.</p></div>
              <AudienceVisual />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.chapterSectionAlt}>
        <div className={styles.shell}>
          <ChapterHeading
            number="04"
            eyebrow="Convert & operate"
            title="Move qualified intent toward the right human."
            text="Maia handles repetitive operational work around the opportunity. The human team keeps judgement, negotiation, relationship and closing."
          />
          <div className={styles.storyStack}>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Viewing workflow</span><h3>Turn intent into a booked next step.</h3><p>Appointment context, confirmation, reminders and CRM state stay connected so the agent does not have to manually reconstruct the booking later.</p></div>
              <AppointmentVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Human handoff</span><h3>The agent enters informed, not blind.</h3><p>Before a human takes over, the buyer history, property interest, payment preference, questions and appointment context are already organized.</p></div>
              <HandoffVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>After the sale starts</span><h3>Keep repetitive customer operations moving.</h3><p>Where an installment workflow is configured, Maia can continue approved reminders while the customer record remains available for future relevant opportunities.</p></div>
              <InstallmentVisual />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.revealSection}>
        <div className={styles.shell}>
          <div className={styles.revealHeading}>
            <span className={styles.eyebrow}>The complete system</span>
            <h2>This is why Maia is more than a chatbot.</h2>
            <p>The customer-facing conversation is only one layer. Behind it sits the property data, CRM state, follow-up logic, scheduling, customer history and human handoff that keep the operation moving.</p>
          </div>
          <OperatingSystemRevealVisual />
        </div>
      </section>

      <section className={styles.outcomeSection}>
        <div className={styles.shell}>
          <div className={styles.outcomeGrid}>
            <article><span>01</span><strong>Faster first response</strong><p>Buyer intent can be handled while it is still fresh.</p></article>
            <article><span>02</span><strong>Better lead organization</strong><p>Useful conversation context becomes a record the team can work with.</p></article>
            <article><span>03</span><strong>More consistent follow-up</strong><p>Next actions no longer depend entirely on staff memory.</p></article>
            <article><span>04</span><strong>Better prepared handoff</strong><p>Human agents receive the customer history before they take over.</p></article>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.shell}>
          <div className={styles.ctaCard}>
            <div>
              <span className={styles.eyebrow}>Maia for real estate</span>
              <h2>Turn property enquiries into a system your team can actually operate.</h2>
              <p>See the Fluxknight plans built around customer conversations, follow-up, CRM and operational automation.</p>
            </div>
            <div className={styles.ctaActions}>
              <Link className={styles.primary} href="/pricing">See pricing <ArrowRight size={17} /></Link>
              <Link className={styles.secondary} href="/evaluation">Evaluate your business</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
