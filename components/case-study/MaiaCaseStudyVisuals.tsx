import type { ReactNode } from "react";
import {
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  Filter,
  History,
  Megaphone,
  MessageSquareText,
  Send,
  Sparkles,
  Target,
  UserCheck,
  UsersRound,
} from "@/components/admin/ServerIcons";
import styles from "./MaiaCaseStudyVisuals.module.css";

function StatePill({ children, tone = "violet" }: { children: ReactNode; tone?: "violet" | "green" | "amber" | "rose" }) {
  const toneClass =
    tone === "green" ? styles.green :
    tone === "amber" ? styles.amber :
    tone === "rose" ? styles.rose : "";
  return <span className={`${styles.statePill} ${toneClass}`}>{children}</span>;
}

function PanelLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className={styles.panelLabel}>{icon}{children}</div>;
}


export function MarketingLeakVisual() {
  return (
    <div className={styles.leakVisual} aria-label="Marketing attention and lead leakage illustration">
      <div className={styles.leakDetailGrid}>
        <div className={styles.campaignCard}>
          <PanelLabel icon={<Megaphone size={14} />}>Property launch campaign</PanelLabel>
          <div className={styles.campaignContextFrame}>
            <img
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/5a9cd5a8-6b6a-4921-b19f-954c506d15d7.jpg"
              alt="Prospect viewing a Maia property recommendation during a property launch campaign."
              className={styles.campaignContextImage}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </div>
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
    </div>
  );
}

export function CaptureVisual() {
  return (
    <div className={styles.splitVisual}>
      <section className={styles.sourcePanel}>
        <PanelLabel icon={<Megaphone size={14} />}>Acquisition source</PanelLabel>
        <div className={styles.acquisitionContextFrame}>
          <img
            src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/ef264b55-8c9f-4499-82cd-94f7ae6c0f31.jpg"
            alt="Fluxknight acquisition journey showing campaign interest moving into conversation and organized lead follow-up."
            className={styles.acquisitionContextImage}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className={styles.sourcePath}><span>Ad / social</span><b>→</b><span>CTA</span><b>→</b><span>WhatsApp / web</span></div>
      </section>
      <section className={styles.chatPanel}>
        <PanelLabel icon={<MessageSquareText size={14} />}>Maia responds</PanelLabel>
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
        <PanelLabel icon={<MessageSquareText size={14} />}>Natural qualification</PanelLabel>
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
      <PanelLabel icon={<Database size={14} />}>CRM profile</PanelLabel>
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
      <div className={styles.stageTrack}><span>New</span><i /><span className={styles.activeStage}>Qualified</span><i /><span>Viewing</span></div>
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
        <PanelLabel icon={<MessageSquareText size={14} />}>Context-aware Q&A</PanelLabel>
        <div className={styles.bubbleCustomer}>Which options fit what I told you, and which one has a flexible payment plan?</div>
        <div className={styles.bubbleMaia}>I found two configured options that match your preferences. Parkside includes a payment-plan option in the property data.</div>
      </section>
      <section className={styles.recommendations}>
        <PanelLabel icon={<Target size={14} />}>Property recommendations</PanelLabel>
        <div className={styles.propertyCards}>
          {properties.map((property) => (
            <article key={property.name}>
              <div className={styles.propertyImage}><span>{property.status}</span></div>
              <div><strong>{property.name}</strong><p>{property.meta}</p></div>
              <span className={styles.visualAction}>View details</span>
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
      <PanelLabel icon={<Clock3 size={14} />}>Contextual follow-up</PanelLabel>
      <div className={styles.timeline}>
        {events.map(([time, title, detail], index) => (
          <div className={styles.timelineItem} key={title}>
            <div className={`${styles.timelineDot} ${index === 2 ? styles.timelineDotActive : ""}`} />
            <span>{time}</span>
            <div><strong>{title}</strong><p>{detail}</p></div>
          </div>
        ))}
      </div>
      <div className={styles.followupMessage}><Send size={15} /><p>You asked about the 2-bedroom units in the upcoming development. I can send the latest approved update if you&apos;re still interested.</p></div>
    </div>
  );
}

export function AudienceVisual() {
  const filters = ["Launch interest", "Investor", "2-bedroom", "Installment interest", "Warm lead"];
  return (
    <div className={styles.audiencePanel}>
      <div className={styles.audienceHead}>
        <PanelLabel icon={<UsersRound size={14} />}>Reusable launch audience</PanelLabel>
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

export function LaunchCampaignVisual() {
  return (
    <div className={styles.launchCampaignImageFrame}>
      <img
        src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/dda57b32-bb9c-4322-8ccb-f367731b3702.jpg"
        alt="Property launch campaign visual showing social engagement, comments and buyer interest around a real estate launch."
        className={styles.launchCampaignImage}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export function PromotionLifecycleVisual() {
  const steps = [
    ["Offer live", "Relevant audience selected", "green"],
    ["7 days left", "Reminder window", "violet"],
    ["48 hours left", "Expiry reminder", "amber"],
    ["Final day", "Last approved reminder", "rose"],
  ] as const;
  return (
    <div className={styles.promoPanel}>
      <div className={styles.promoHead}>
        <PanelLabel icon={<BellRing size={14} />}>Promotion lifecycle</PanelLabel>
        <span>Example timing · configured per campaign</span>
      </div>
      <div className={styles.promoTimeline}>
        {steps.map(([title, detail, tone], index) => (
          <div className={styles.promoStep} key={title}>
            <div className={styles.promoIndex}>{String(index + 1).padStart(2, "0")}</div>
            <div><strong>{title}</strong><p>{detail}</p></div>
            <StatePill tone={tone}>{index === 0 ? "Start" : index === 3 ? "Final" : "Scheduled"}</StatePill>
          </div>
        ))}
      </div>
      <div className={styles.followupMessage}><Send size={15}/><p>You previously asked about this property. The configured promotion is ending soon, and I can show you the current options if you are still considering it.</p></div>
    </div>
  );
}

export function LongTermNurtureVisual() {
  const months = [
    ["Jan", "Initial enquiry", "Buyer profile created"],
    ["Feb", "Property comparison", "Preferences refined"],
    ["Apr", "Relevant launch update", "Customer re-engaged"],
    ["Jun", "New matching inventory", "Opportunity surfaced"],
    ["Sep", "Buyer returns", "Viewing intent confirmed"],
  ];
  return (
    <div className={styles.nurturePanel}>
      <div className={styles.nurtureHead}>
        <PanelLabel icon={<History size={14} />}>Long-term customer memory</PanelLabel>
        <StatePill>Persistent context</StatePill>
      </div>
      <div className={styles.nurtureTrack}>
        {months.map(([month, title, detail], index) => (
          <div className={`${styles.nurtureEvent} ${index === months.length - 1 ? styles.nurtureActive : ""}`} key={month}>
            <span>{month}</span><i />
            <div><strong>{title}</strong><p>{detail}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppointmentVisual() {
  return (
    <div className={styles.appointmentVisual}>
      <section className={styles.chatPanel}>
        <PanelLabel icon={<MessageSquareText size={14} />}>Buyer conversation</PanelLabel>
        <div className={styles.bubbleCustomer}>Saturday works for me.</div>
        <div className={styles.bubbleMaia}>Your viewing is confirmed for Saturday at 11:00 AM. I&apos;ll also send the configured reminder before the appointment.</div>
      </section>
      <section className={styles.calendarPanel}>
        <PanelLabel icon={<CalendarCheck2 size={14} />}>Viewing booked</PanelLabel>
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

export function AppointmentReminderVisual() {
  const reminders = [
    ["Booking confirmed", "Immediately", "green"],
    ["Viewing reminder", "24 hours before", "violet"],
    ["Final reminder", "2 hours before", "amber"],
  ] as const;
  return (
    <div className={styles.reminderPanel}>
      <PanelLabel icon={<BellRing size={14} />}>Appointment reminder sequence</PanelLabel>
      <div className={styles.reminderGrid}>
        {reminders.map(([title, timing, tone], index) => (
          <article key={title}>
            <span className={styles.reminderNumber}>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{title}</strong><p>{timing}</p></div>
            <StatePill tone={tone}>{index === 0 ? "Sent" : "Scheduled"}</StatePill>
          </article>
        ))}
      </div>
      <div className={styles.reminderMeta}><span>Customer notified</span><span>Agent notified</span><span>CRM event logged</span></div>
    </div>
  );
}

export function HandoffVisual() {
  return (
    <div className={styles.handoffPanel}>
      <div className={styles.handoffHead}>
        <div><PanelLabel icon={<UserCheck size={14} />}>Human handoff</PanelLabel><h3>Qualified buyer ready for a human agent.</h3></div>
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
          <div className={styles.handoffActions}><span>Open conversation</span><span>View lead</span><span className={styles.primaryAction}>Take over</span></div>
        </div>
      </div>
    </div>
  );
}

export function DealProgressionVisual() {
  const stages = [
    ["Qualified", "Maia", "green"],
    ["Viewing booked", "Maia + team", "green"],
    ["Viewed", "Human team", "violet"],
    ["Offer / reservation", "Human team", "violet"],
    ["Payment", "Human + system", "amber"],
    ["Customer", "CRM", "green"],
  ] as const;
  return (
    <div className={styles.dealPanel}>
      <div className={styles.dealHead}>
        <PanelLabel icon={<Target size={14} />}>Deal progression</PanelLabel>
        <span>Automation supports the process. Humans own judgement and closing.</span>
      </div>
      <div className={styles.dealTrack}>
        {stages.map(([stage, owner, tone], index) => (
          <div className={styles.dealStage} key={stage}>
            <div className={styles.dealNode}>{index + 1}</div>
            <div><strong>{stage}</strong><p>{owner}</p></div>
            <StatePill tone={tone}>{index < 2 ? "System-led" : index === 5 ? "Recorded" : "Human-led"}</StatePill>
          </div>
        ))}
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
      <PanelLabel icon={<CircleDollarSign size={14} />}>Post-sale reminders</PanelLabel>
      <div className={styles.installmentGrid}>
        <div className={styles.paymentSchedule}>
          {schedule.map(([label, state, tone]) => (
            <div key={label}><span>{label}</span><StatePill tone={tone}>{state}</StatePill></div>
          ))}
        </div>
        <div className={styles.followupMessage}><Send size={15} /><p>Your next configured installment is coming up. I can send the approved payment details or route you to the team if you need help.</p></div>
      </div>
    </div>
  );
}

export function FutureOpportunityVisual() {
  return (
    <div className={styles.futurePanel}>
      <div className={styles.futureCustomer}>
        <PanelLabel icon={<Database size={14} />}>Existing customer record</PanelLabel>
        <div className={styles.futureIdentity}><div className={styles.avatar}>AM</div><div><strong>Alex Morgan</strong><span>Previous buyer · investment profile</span></div></div>
        <dl className={styles.futureFacts}>
          <div><dt>Known interest</dt><dd>Investment property</dd></div>
          <div><dt>Payment preference</dt><dd>Flexible plan</dd></div>
          <div><dt>Last transaction</dt><dd>Customer history retained</dd></div>
        </dl>
      </div>
      <div className={styles.futureArrow}>→</div>
      <div className={styles.futureMatch}>
        <PanelLabel icon={<Sparkles size={14} />}>Future relevant opportunity</PanelLabel>
        <strong>New investment release</strong>
        <p>The system can surface this customer into an appropriate future audience based on configured preferences and consent.</p>
        <StatePill>Relevant match</StatePill>
      </div>
    </div>
  );
}

export function OperatingSystemRevealVisual() {
  const activity = [
    ["09:14", "Lead captured", "Launch campaign → WhatsApp"],
    ["09:18", "Qualified", "Budget, intent and payment preference saved"],
    ["Day 2", "Follow-up sent", "Previous property context retained"],
    ["Fri", "Viewing booked", "Calendar, agent and CRM updated"],
    ["Sat", "Human handoff", "Sales team receives full context"],
  ];

  return (
    <div className={styles.systemReveal}>
      <div className={styles.systemRevealHead}>
        <div>
          <Sparkles size={16} />
          <div><span>Maia Real Estate Operating System</span><small>One customer journey, one connected operating layer</small></div>
        </div>
        <StatePill tone="green">Connected</StatePill>
      </div>

      <div className={styles.osBoard}>
        <section className={styles.osSources}>
          <PanelLabel icon={<Megaphone size={14} />}>Marketing & entry points</PanelLabel>
          <div className={styles.osSourceHero}>
            <span>Property launch</span>
            <strong>Campaign creates demand</strong>
            <p>Ads, social, website and lead campaigns move prospects into identifiable conversations.</p>
          </div>
          <div className={styles.osSourceList}>
            <span>Paid ads</span><span>Organic social</span><span>Website</span><span>Lead forms</span>
          </div>
        </section>

        <section className={styles.osMaia}>
          <div className={styles.osMaiaHeader}>
            <div className={styles.maiaOrb}>✦</div>
            <div><span>AI operating layer</span><strong>Maia</strong></div>
            <StatePill>Active</StatePill>
          </div>
          <div className={styles.osMaiaFlow}>
            <div><MessageSquareText size={14} /><span>Converse</span></div>
            <div><Target size={14} /><span>Qualify</span></div>
            <div><Sparkles size={14} /><span>Recommend</span></div>
            <div><Clock3 size={14} /><span>Follow up</span></div>
            <div><BellRing size={14} /><span>Remind</span></div>
            <div><CalendarCheck2 size={14} /><span>Schedule</span></div>
          </div>
          <div className={styles.osConversation}>
            <span>Customer</span>
            <p>I&apos;d like to see the 2-bedroom option this weekend.</p>
            <span>Maia</span>
            <p>Your preferences are already saved. I can move this into the viewing workflow and keep the assigned team member updated.</p>
          </div>
        </section>

        <section className={styles.osOperations}>
          <PanelLabel icon={<Database size={14} />}>Real estate operations</PanelLabel>
          <div className={styles.osMetricGrid}>
            <div><span>Lead</span><strong>Qualified</strong></div>
            <div><span>Property</span><strong>Matched</strong></div>
            <div><span>Follow-up</span><strong>Active</strong></div>
            <div><span>Viewing</span><strong>Booked</strong></div>
          </div>
          <div className={styles.osOpsList}>
            <span><CheckCircle2 size={13}/> Conversation history retained</span>
            <span><CheckCircle2 size={13}/> Customer preferences structured</span>
            <span><CheckCircle2 size={13}/> Appointment state connected</span>
            <span><CheckCircle2 size={13}/> Next action visible to team</span>
          </div>
        </section>

        <section className={styles.osTimeline}>
          <div className={styles.osTimelineHead}>
            <PanelLabel icon={<History size={14} />}>Customer activity</PanelLabel>
            <span>Shared operational history</span>
          </div>
          <div className={styles.osTimelineGrid}>
            {activity.map(([time, title, detail], index) => (
              <div className={styles.osTimelineItem} key={title}>
                <span>{time}</span>
                <i className={index === activity.length - 1 ? styles.osTimelineActive : ""} />
                <div><strong>{title}</strong><p>{detail}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.osHuman}>
          <div className={styles.osHumanHead}>
            <PanelLabel icon={<UserCheck size={14} />}>Human team</PanelLabel>
            <StatePill tone="green">Context ready</StatePill>
          </div>
          <div className={styles.osHandoffCard}>
            <div className={styles.avatar}>AM</div>
            <div>
              <span>Alex Morgan</span>
              <strong>High-intent buyer · viewing booked</strong>
              <p>Investment buyer, 2-bedroom preference, flexible payment interest. Key questions and conversation history are already attached.</p>
            </div>
          </div>
          <div className={styles.osHumanActions}>
            <span>View lead</span><span>Open conversation</span><span className={styles.primaryAction}>Take over</span>
          </div>
          <p className={styles.osBoundary}>Maia handles repetitive operational work. Humans own judgement, negotiation, documentation and closing.</p>
        </section>
      </div>

      <div className={styles.osFooter}>
        <span>Marketing</span><b>→</b><span>Customer channel</span><b>→</b><span>Maia</span><b>→</b><span>CRM & automation</span><b>→</b><span>Human team</span>
      </div>
    </div>
  );
}
