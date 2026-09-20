import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "@/components/admin/ServerIcons";
import {
  AppointmentReminderVisual,
  AppointmentVisual,
  AudienceVisual,
  CaptureVisual,
  DealProgressionVisual,
  FollowUpVisual,
  FutureOpportunityVisual,
  HandoffVisual,
  InstallmentVisual,
  LaunchCampaignVisual,
  LongTermNurtureVisual,
  MarketingLeakVisual,
  OperatingSystemRevealVisual,
  PromotionLifecycleVisual,
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
          <div className={styles.heroTextOnly}>
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
          </div>
        </div>
      </section>

      <section className={styles.journeyVisualSection} id="story">
        <div className={styles.shell}>
          <div className={styles.journeyVisualFrame}>
            <img
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/968f71cf-feec-441c-9904-131b0e06e88c.png"
              alt="Maia case study journey showing Capture, Understand, Nurture, and Convert and operate as a four-stage workflow."
              className={styles.journeyVisualImage}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      <section className={styles.storySection}>
        <div className={styles.shell}>
          <div className={styles.attentionRevenueVisual}>
            <img
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/e6892ebc-a728-4ea9-af14-c0ff00014c05.jpg"
              alt="Fluxknight visual showing social media, WhatsApp, website chat and email leads flowing through Fluxknight into an organized sales pipeline."
              className={styles.attentionRevenueImage}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </div>
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
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Property launch</span><h3>When the property goes live, the audience is already organized.</h3><p>Maia can send configured, approved updates to the relevant prospects and log that activity back into the customer record instead of starting another manual outreach exercise from zero.</p></div>
              <LaunchCampaignVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Promotion lifecycle</span><h3>Keep time-sensitive offers visible without relying on staff memory.</h3><p>Promotions can have a defined communication sequence, from launch through expiry reminders, while keeping every message relevant to the prospect&apos;s recorded interest.</p></div>
              <PromotionLifecycleVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Long-term nurture</span><h3>Keep the customer relationship useful beyond the first week.</h3><p>A prospect who is not ready today can still become valuable months later because their preferences, history and previous questions remain available when a genuinely relevant opportunity appears.</p></div>
              <LongTermNurtureVisual />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.chapterSectionAlt}>
        <div className={styles.shell}>
          <div className={styles.convertHeaderVisual}>
            <img
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/248cb0e6-ab3f-43b2-9f2c-c1a2f4d9d77a.png"
              alt="Qualified real-estate enquiry routed by Maia to the right agent with viewing details organized."
              className={styles.convertHeaderImage}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </div>
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
              <div className={styles.storyCopy}><span>Appointment reminders</span><h3>Keep the viewing moving before the agent has to chase it.</h3><p>The customer and team can receive configured reminders around the appointment while the booking remains connected to the lead and property record.</p></div>
              <AppointmentReminderVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Human handoff</span><h3>The agent enters informed, not blind.</h3><p>Before a human takes over, the buyer history, property interest, payment preference, questions and appointment context are already organized.</p></div>
              <HandoffVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Deal progression</span><h3>Automation supports the process. The human still closes the deal.</h3><p>Maia keeps records, reminders and next actions connected while the human team handles viewing, negotiation, documentation, relationship and closing.</p></div>
              <DealProgressionVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>After the sale starts</span><h3>Keep repetitive customer operations moving.</h3><p>Where an installment workflow is configured, Maia can continue approved reminders while the customer record remains available for future relevant opportunities.</p></div>
              <InstallmentVisual />
            </div>
            <div className={styles.storyBeat}>
              <div className={styles.storyCopy}><span>Future opportunity</span><h3>The customer record keeps creating value after the first transaction.</h3><p>When a future property matches known preferences and the communication is appropriate, the existing customer can be surfaced into a relevant campaign instead of being treated like a stranger again.</p></div>
              <FutureOpportunityVisual />
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
          <div className={styles.outcomeHeading}>
            <div>
              <span className={styles.eyebrow}>Operational proof</span>
              <h2>Maia is built around the work that usually gets dropped.</h2>
            </div>
            <p>The value is not a dramatic AI statistic. It is the removal of repeated operational gaps between marketing, conversations, follow-up, appointments and the sales team.</p>
          </div>

          <div className={styles.proofLedger} aria-label="Operational changes Maia is designed to create">
            <article>
              <span className={styles.proofNumber}>01</span>
              <div><strong>First response</strong><p>New enquiries can be handled while buyer intent is still fresh.</p></div>
              <div className={styles.proofShift}><span>Before</span><b>Inbox waits for a person</b></div>
              <div className={styles.proofShiftActive}><span>With Maia</span><b>Conversation starts and context is captured</b></div>
            </article>
            <article>
              <span className={styles.proofNumber}>02</span>
              <div><strong>Customer memory</strong><p>Useful details from the conversation become structured lead context.</p></div>
              <div className={styles.proofShift}><span>Before</span><b>Information sits in scattered chats</b></div>
              <div className={styles.proofShiftActive}><span>With Maia</span><b>Preferences, history and next action stay connected</b></div>
            </article>
            <article>
              <span className={styles.proofNumber}>03</span>
              <div><strong>Follow-through</strong><p>Relevant follow-up can continue after the first conversation goes quiet.</p></div>
              <div className={styles.proofShift}><span>Before</span><b>Staff memory decides who gets contacted</b></div>
              <div className={styles.proofShiftActive}><span>With Maia</span><b>Configured follow-up and reminders keep moving</b></div>
            </article>
            <article>
              <span className={styles.proofNumber}>04</span>
              <div><strong>Human handoff</strong><p>The sales team receives a usable customer story instead of a cold contact.</p></div>
              <div className={styles.proofShift}><span>Before</span><b>Agent starts by asking everything again</b></div>
              <div className={styles.proofShiftActive}><span>With Maia</span><b>Buyer context, property interest and history arrive together</b></div>
            </article>
          </div>

          <div className={styles.proofBoundary}>
            <CheckCircle2 size={17} />
            <p>Maia is designed to improve operational consistency. Actual commercial results still depend on lead quality, the business offer, workflow configuration and the human sales team.</p>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.shell}>
          <div className={styles.ctaCard}>
            <div className={styles.ctaCopy}>
              <span className={styles.eyebrow}>Maia for real estate</span>
              <h2>Stop letting good property enquiries disappear between messages.</h2>
              <p>Fluxknight connects the conversations, customer data, follow-up, viewing workflows and human handoff behind your real-estate sales process.</p>
              <div className={styles.ctaProofLine}>
                <span>Capture</span><b>→</b><span>Qualify</span><b>→</b><span>Follow up</span><b>→</b><span>Book</span><b>→</b><span>Hand off</span>
              </div>
            </div>
            <div className={styles.ctaAside}>
              <span className={styles.ctaAsideLabel}>Ready to see the plans?</span>
              <div className={styles.ctaActions}>
                <Link className={styles.primary} href="/pricing">See pricing <ArrowRight size={17} /></Link>
                <Link className={styles.secondary} href="/evaluation">Evaluate your business</Link>
              </div>
              <small>Choose a plan directly, or use the evaluation if you need help mapping Maia to your current workflow.</small>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
