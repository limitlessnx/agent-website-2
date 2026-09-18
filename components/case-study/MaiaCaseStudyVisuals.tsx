"use client";

import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Database,
  Filter,
  Megaphone,
  MessageSquareText,
  Send,
  Sparkles,
  Target,
  UserCheck,
  UsersRound,
} from "@/components/admin/ServerIcons";
import styles from "./MaiaCaseStudyVisuals.module.css";

function StatePill({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "green" | "amber" }) {
  return <span className={`${styles.statePill} ${styles[tone]}`}>{children}</span>;
}

export function HeroSystemVisual() {
  return (
    <div className={styles.heroSystem} aria-label="Illustrative Maia buyer journey">
      <div className={styles.heroSystemHead}>
        <div>
          <span>Live customer journey</span>
          <strong>Maia · Real estate operating system</strong>
        </div>
        <StatePill tone="green">Active</StatePill>
      </div>

      <div className={styles.heroSystemGrid}>
        <section className={styles.chatPanel}>
          <div className={styles.panelLabel}><MessageSquareText size={14} /> Customer conversation</div>
          <div className={styles.chatIdentity}>
            <div className={styles.avatar}>AM</div>
            <div><strong>Alex Morgan</strong><span>Launch campaign enquiry</span></div>
          </div>
          <div className={styles.bubbleCustomer}>I&apos;m interested in the new development. When does it launch?</div>
          <div className={styles.bubbleMaia}>I can help with that. I&apos;ll keep your interest linked to this development and can notify you when launch details are available.</div>
          <div className={styles.systemEvent}><CheckCircle2 size={13} /> Context saved to lead record</div>
        </section>

        <section className={styles.profilePanel}>
          <div className={styles.panelLabel}><Database size={14} /> Lead intelligence</div>
          <div className={styles.profileHead}>
            <div><strong>Alex Morgan</strong><span>Qualified prospect</span></div>
            <StatePill>Warm</StatePill>
          </div>
          <dl className={styles.profileGrid}>
            <div><dt>Source</dt><dd>Launch campaign</dd></div>
            <div><dt>Interest</dt><dd>Upcoming development</dd></div>
            <div><dt>Purpose</dt><dd>Investment</dd></div>
            <div><dt>Timeline</dt><dd>3–6 months</dd></div>
          </dl>
          <div className={styles.nextAction}>
            <Clock3 size={15} />
            <div><span>Next action</span><strong>Send launch update when approved</strong></div>
          </div>
        </section>

        <section className={styles.actionPanel}>
          <div className={styles.panelLabel}><Target size={14} /> Recommended next step</div>
          <div className={styles.propertyThumb} aria-hidden="true">
            <div className={styles.propertyGlow} />
            <span>Property preview</span>
          </div>
          <div className={styles.propertyMeta}>
            <span>Matching inventory</span>
            <strong>2 suitable options available</strong>
            <p>Maia can surface configured property information and move Alex toward a viewing when intent increases.</p>
          </div>
          <div className={styles.actionStrip}><CalendarCheck2 size={14} /> Viewing workflow ready</div>
        </section>
      </div>
    </div>
  );
}

export function MarketingLeakVisual() {
  return (
    <div className={styles.leakVisual} aria-label="Marketing attention and lead leakage illustration">
      <div className={styles.campaignCard}>
        <div className={styles.panelLabel}><Megaphone size={14} /> Property launch campaign</div>
        <div className={styles.campaignArtwork}><span>COMING SOON</span><strong>New residential release</strong></div>
        <div className={styles.engagementRow}>
          <span>Comments</span><span>Messages</span><span>WhatsApp clicks</span><span>Lead forms</span>
        </div>
      </div>
      <div className={styles.leakArrow}>→</div>
      <div className={styles.leakStack}>
        <div><MessageSquareText size={15} /><span>Unanswered enquiry</span></div>
        <div><Clock3 size={15} /><span>Follow-up forgotten</span></div>
        <div><Database size={15} /><span>Contact never organized</span></div>
        <div className={styles.savedPath}><Sparkles size={15} /><span>Maia converts the interaction into a tracked next action</span></div>
      </div>
    </div>
  );
}

export function CaptureVisual() {
  return (
    <div className={styles.splitVisual}>
      <section className={styles.sourcePanel}>
        <div className={styles.panelLabel}><Megaphone size={14} /> Acquisition source</div>
        <div className={styles.sourceHero}><span>Property launch</span><strong>Get priority updates</strong><p>Prospect moves from campaign interest into an identifiable conversation.</p></div>
        <div className={styles.sourcePath}>
          <span>Ad / social</span><b>→</b><span>CTA</span><b>→</b><span>WhatsApp / web</span>
        </div>
      </section>

      <section className={styles.chatPanel}>
        <div className={styles.panelLabel}><MessageSquareText size={14} /> Maia responds</div>
        <div className={styles.bubbleCustomer}>Can you notify me when this property officially launches?</div>
        <div className={styles.bubbleMaia}>Absolutely. I can keep your interest connected to this launch and send the approved update when it becomes available.</div>
        <div className={styles.systemEvent}><Database size={13} /> Lead created · source saved · interest linked</div>
      </section>
    </div>
  );
}

export function QualificationVisual() {
  return (
    <div className={styles.splitVisual}>
      <section className={styles.chatPanel}>
        <div className={styles.panelLabel}><MessageSquareText size={14} /> Natural qualification</div>
        <div className={styles.bubbleMaia}>What type of property are you considering, and is the purchase mainly for investment or personal use?</div>
        <div className={styles.bubbleCustomer}>A 2-bedroom investment property. I&apos;d prefer a flexible payment plan.</div>
        <div className={styles.bubbleMaia}>Understood. I&apos;ll keep those preferences attached to your profile so I can show relevant options.</div>
      </section>
      <LeadProfileVisual compact />
    </div>
  );
}

export function LeadProfileVisual({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`${styles.profilePanel} ${compact ? styles.compactProfile : ""}`}>
      <div className={styles.panelLabel}><Database size={14} /> CRM profile</div>
      <div className={styles.profileHead}>
        <div><strong>Alex Morgan</strong><span>Customer context</span></div>
        <StatePill>Qualified</StatePill>
      </div>
      <dl className={styles.profileGrid}>
        <div><dt>Property type</dt><dd>2-bedroom</dd></div>
        <div><dt>Purpose</dt><dd>Investment</dd></div>
        <div><dt>Budget</dt><dd>Captured</dd></div>
        <div><dt>Payment</dt><dd>Installment interest</dd></div>
        <div><dt>Location</dt><dd>Preferred area saved</dd></div>
        <div><dt>Timeline</dt><dd>3–6 months</dd></div>
      </dl>
      <div className={styles.stageTrack}>
        <span>New</span><i /><span className={styles.activeStage}>Qualified</span><i /><span>Viewing</span>
      </div>
    </section>
  );
}

export function PropertyMatchVisual() {
  const properties = [
    { name: "Harbour Residences", meta: "2 bed · Investment-ready", status: "Available" },
    { name: "Parkside Collection", meta: "2 bed · Payment plan", status: "Match" },
  ];
  return (
    <div className={styles.propertyMatch}>
      <section className={styles.chatPanel}>
        <div className={styles.panelLabel}><MessageSquareText size={14} /> Context-aware Q&A</div>
        <div className={styles.bubbleCustomer}>Which options fit what I told you, and which one has a flexible payment plan?</div>
        <div className={styles.bubbleMaia}>I found two configured options that match your preferences. Parkside includes a payment-plan option in the property data.</div>
      </section>
      <section className={styles.recommendations}>
        <div className={styles.panelLabel}><Target size={14} /> Property recommendations</div>
        <div className={styles.propertyCards}>
          {properties.map((property) => (
            <article key={property.name}>
              <div className={styles.propertyImage}><span>{property.status}</span></div>
              <div><strong>{property.name}</strong><p>{property.meta}</p></div>
              <button type="button">View details</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function FollowUpVisual() {
  const events = [
    ["Day 0", "Initial enquiry", "Interest and preferences saved"],
    ["Day 2", "Follow-up due", "No reply detected"],
    ["Day 2", "Maia follows up", "Previous property interest referenced"],
    ["Day 3", "Prospect returns", "Conversation resumes with context"],
  ];
  return (
    <div className={styles.timelinePanel}>
      <div className={styles.panelLabel}><Clock3 size={14} /> Contextual follow-up</div>
      <div className={styles.timeline}>
        {events.map(([time, title, detail], index) => (
          <div className={styles.timelineItem} key={title}>
            <div className={`${styles.timelineDot} ${index === 2 ? styles.timelineDotActive : ""}`} />
            <span>{time}</span>
            <div><strong>{title}</strong><p>{detail}</p></div>
          </div>
        ))}
      </div>
      <div className={styles.followupMessage}>
        <Send size={15} />
        <p>You asked about the 2-bedroom units in the upcoming development. I can send the latest approved update if you&apos;re still interested.</p>
      </div>
    </div>
  );
}

export function AudienceVisual() {
  const filters = ["Launch interest", "Investor", "2-bedroom", "Installment interest", "Warm lead"];
  return (
    <div className={styles.audiencePanel}>
      <div className={styles.audienceHead}>
        <div className={styles.panelLabel}><UsersRound size={14} /> Reusable launch audience</div>
        <StatePill>Example segment</StatePill>
      </div>
      <div className={styles.filterRow}><Filter size={14} />{filters.map((filter) => <span key={filter}>{filter}</span>)}</div>
      <div className={styles.audienceRows}>
        {["Alex Morgan", "Taylor Reed", "Jordan Lee"].map((name, index) => (
          <div key={name}>
            <div className={styles.avatar}>{name.split(" ").map((n) => n[0]).join("")}</div>
            <div><strong>{name}</strong><span>{index === 0 ? "Launch campaign · warm" : "Relevant property interest"}</span></div>
            <span className={styles.rowAction}>{index === 0 ? "Update ready" : "In segment"}</span>
          </div>
        ))}
      </div>
      <div className={styles.campaignAction}><Megaphone size={15} /><div><span>Approved update</span><strong>Notify relevant prospects when the launch goes live</strong></div></div>
    </div>
  );
}

export function AppointmentVisual() {
  return (
    <div className={styles.appointmentVisual}>
      <section className={styles.chatPanel}>
        <div className={styles.panelLabel}><MessageSquareText size={14} /> Buyer conversation</div>
        <div className={styles.bubbleCustomer}>Saturday works for me.</div>
        <div className={styles.bubbleMaia}>Your viewing is confirmed for Saturday at 11:00 AM. I&apos;ll also send the configured reminder before the appointment.</div>
      </section>
      <section className={styles.calendarPanel}>
        <div className={styles.panelLabel}><CalendarCheck2 size={14} /> Viewing booked</div>
        <div className={styles.calendarDate}><span>Saturday</span><strong>11:00 AM</strong></div>
        <dl>
          <div><dt>Prospect</dt><dd>Alex Morgan</dd></div>
          <div><dt>Property</dt><dd>Harbour Residences</dd></div>
          <div><dt>Assigned agent</dt><dd>Sales team</dd></div>
        </dl>
        <div className={styles.reminderStrip}><Clock3 size={14} /> Confirmation sent · reminder scheduled · CRM updated</div>
      </section>
    </div>
  );
}

export function HandoffVisual() {
  return (
    <div className={styles.handoffPanel}>
      <div className={styles.handoffHead}>
        <div><span className={styles.panelLabel}><UserCheck size={14} /> Human handoff</span><h3>Qualified buyer ready for a human agent.</h3></div>
        <StatePill tone="green">Ready</StatePill>
      </div>
      <div className={styles.handoffGrid}>
        <dl>
          <div><dt>Prospect</dt><dd>Alex Morgan</dd></div>
          <div><dt>Interest</dt><dd>Harbour Residences · 2-bedroom</dd></div>
          <div><dt>Purpose</dt><dd>Investment</dd></div>
          <div><dt>Payment</dt><dd>Installment preference</dd></div>
          <div><dt>Viewing</dt><dd>Saturday · 11:00 AM</dd></div>
          <div><dt>Lead stage</dt><dd>High intent</dd></div>
        </dl>
        <div className={styles.summaryCard}>
          <span>Conversation summary</span>
          <p>Alex came through the launch campaign, wants a 2-bedroom investment property, prefers a flexible payment plan and has booked a viewing. Key questions are payment schedule and documentation.</p>
          <div className={styles.handoffActions}><button type="button">Open conversation</button><button type="button">View lead</button><button type="button" className={styles.primaryAction}>Take over</button></div>
        </div>
      </div>
    </div>
  );
}

export function InstallmentVisual() {
  const schedule = [
    ["Deposit", "Paid", "green"],
    ["Installment 2", "Upcoming", "amber"],
    ["Installment 3", "Scheduled", "violet"],
  ] as const;
  return (
    <div className={styles.installmentPanel}>
      <div className={styles.panelLabel}><CalendarCheck2 size={14} /> Post-sale reminders</div>
      <div className={styles.installmentGrid}>
        <div className={styles.paymentSchedule}>
          {schedule.map(([label, state, tone]) => (
            <div key={label}><span>{label}</span><StatePill tone={tone}>{state}</StatePill></div>
          ))}
        </div>
        <div className={styles.followupMessage}>
          <Send size={15} />
          <p>Your next configured installment is coming up. I can send the approved payment details or route you to the team if you need help.</p>
        </div>
      </div>
    </div>
  );
}

export function OperatingSystemRevealVisual() {
  const layers = [
    ["Marketing", "Ads · Social · Website · Lead campaigns"],
    ["Customer channels", "WhatsApp · Web · Supported forms / messaging"],
    ["Maia", "Converse · Qualify · Recommend · Follow up · Remind · Schedule · Escalate"],
    ["Real estate operations", "Leads · Properties · Conversations · Follow-ups · Viewings · Audiences · Customer history"],
    ["Human team", "Priority leads · Handoffs · Viewings · Negotiation · Closing"],
  ];
  return (
    <div className={styles.systemReveal}>
      <div className={styles.systemRevealHead}><Sparkles size={16} /><span>Maia Real Estate Operating System</span></div>
      <div className={styles.systemLayers}>
        {layers.map(([title, detail], index) => (
          <div className={`${styles.systemLayer} ${index === 2 ? styles.maiaLayer : ""}`} key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{title}</strong><p>{detail}</p></div>
            {index < layers.length - 1 && <b>↓</b>}
          </div>
        ))}
      </div>
    </div>
  );
}
