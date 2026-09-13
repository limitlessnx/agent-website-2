import {
  CalendarDays,
  CheckCircle2,
  Database,
  Headphones,
  Mail,
  MessageSquareText,
  Phone,
  UserRound,
  Workflow,
} from "@/components/admin/ServerIcons";
import type { ReactNode } from "react";
import styles from "./FluxProductVisuals.module.css";

type ProductVisualKind = "hero" | "conversations" | "journey" | "operations" | "maia" | "process";

type ProductVisualProps = {
  kind: ProductVisualKind;
  className?: string;
};

const labels = {
  hero: "Fluxknight customer operations dashboard",
  conversations: "Fluxknight customer conversation on a mobile device",
  journey: "Fluxknight follow-up workflow timeline",
  operations: "Fluxknight connected operations workspace",
  maia: "Maia real estate customer journey",
  process: "Fluxknight automation process",
};

function Status({ children }: { children: ReactNode }) {
  return <span className={styles.status}><CheckCircle2 size={12} />{children}</span>;
}

function HeroVisual() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.dashboardTop}><span className={styles.dot} /><strong>Customer operations</strong><span>Today</span></div>
      <div className={styles.metrics}>
        <div><span>New enquiries</span><strong>24</strong><small>Across active channels</small></div>
        <div><span>Next actions</span><strong>11</strong><small>Follow-up and bookings</small></div>
      </div>
      <div className={styles.dashboardBody}>
        <div className={styles.conversationList}>
          <span className={styles.panelLabel}>Live conversations</span>
          <div className={styles.conversationActive}><span className={styles.avatar}>AM</span><div><strong>Amara Mensah</strong><small>Property inspection</small></div><Status>Qualified</Status></div>
          <div className={styles.conversationRow}><span className={styles.avatar}>KO</span><div><strong>Kofi Owusu</strong><small>Booking question</small></div><small>2m</small></div>
          <div className={styles.conversationRow}><span className={styles.avatar}>SA</span><div><strong>Sarah Adebayo</strong><small>Support request</small></div><small>8m</small></div>
        </div>
        <div className={styles.activityPanel}>
          <span className={styles.panelLabel}>What happened next</span>
          <div><CalendarDays size={15} /><span>Inspection held</span><small>3:30 PM</small></div>
          <div><Workflow size={15} /><span>Follow-up scheduled</span><small>Tomorrow</small></div>
          <div><UserRound size={15} /><span>Staff handoff</span><small>Sales team</small></div>
        </div>
      </div>
    </div>
  );
}

function ConversationVisual() {
  return (
    <div className={styles.phoneScene}>
      <div className={`${styles.floatCard} ${styles.floatLeft}`}><MessageSquareText size={15} /><span>New enquiry</span></div>
      <div className={`${styles.floatCard} ${styles.floatRight}`}><CheckCircle2 size={15} /><span>Lead qualified</span></div>
      <div className={`${styles.floatCard} ${styles.floatVoice}`}><Phone size={15} /><span>Voice context saved</span></div>
      <div className={styles.phone}>
        <div className={styles.phoneNotch} />
        <div className={styles.phoneHead}><span className={styles.avatar}>FK</span><div><strong>Fluxknight</strong><small>Customer assistant</small></div><span className={styles.phoneOnline} /></div>
        <div className={styles.phoneMessages}>
          <p className={styles.incoming}>Hi, is the two-bedroom apartment still available?</p>
          <p className={styles.outgoing}>Yes. Which area and move-in date work best for you?</p>
          <p className={styles.incoming}>East Legon, next month.</p>
          <p className={styles.outgoing}>I have captured that. Would you like to book an inspection?</p>
        </div>
        <div className={styles.phoneCompose}><span>Message sent with context</span><SendGlyph /></div>
      </div>
      <div className={`${styles.floatCard} ${styles.floatBottom}`}><CalendarDays size={15} /><span>Follow-up scheduled</span></div>
    </div>
  );
}

function JourneyVisual() {
  const steps = [
    ["Day 0", "Immediate reply", MessageSquareText],
    ["Day 1", "Helpful follow-up", Mail],
    ["Day 3", "Booking reminder", CalendarDays],
    ["Day 7", "Re-engage or hand off", UserRound],
  ] as const;
  return (
    <div className={styles.journeyVisual}>
      <div className={styles.workflowHead}><span>Customer journey</span><Status>Active</Status></div>
      <div className={styles.workflowLine} />
      <div className={styles.workflowSteps}>
        {steps.map(([day, action, Icon]) => <div className={styles.workflowStep} key={day}><span className={styles.stepIcon}><Icon size={16} /></span><div><small>{day}</small><strong>{action}</strong></div><CheckCircle2 size={15} /></div>)}
      </div>
      <div className={styles.recoveryNote}><span>Missed lead recovery</span><strong>Next action is ready when the customer returns.</strong></div>
    </div>
  );
}

function OperationsVisual() {
  return (
    <div className={styles.operationsVisual}>
      <div className={styles.operationRail}><span className={styles.railMark}>F</span><MessageSquareText size={17} /><Workflow size={17} /><Database size={17} /><Headphones size={17} /></div>
      <div className={styles.operationMain}>
        <div className={styles.operationHead}><div><small>Operations workspace</small><strong>Amara Mensah</strong></div><Status>Human handoff ready</Status></div>
        <div className={styles.operationGrid}>
          <div className={styles.crmCard}><span className={styles.panelLabel}>Customer record</span><strong>Qualified property lead</strong><p>East Legon · move-in next month</p><div><span>CRM updated</span><CheckCircle2 size={14} /></div></div>
          <div className={styles.pipelineCard}><span className={styles.panelLabel}>Next action</span><strong>Inspection booking</strong><p>Saturday, 11:00 AM</p><span className={styles.assigned}>Assigned to sales</span></div>
        </div>
        <div className={styles.contentRail}><div><small>Plan</small><strong>Property feature</strong></div><div><small>Create</small><strong>Carousel + caption</strong></div><div><small>Schedule</small><strong>Friday, 10:00 AM</strong></div><div><small>Analyze</small><strong>Response themes</strong></div></div>
      </div>
    </div>
  );
}

function MaiaVisual() {
  const points = ["Enquiry", "Qualified", "Inspection", "Follow-up", "Handoff"];
  return <div className={styles.maiaVisual}><div className={styles.maiaTop}><span>Maia customer journey</span><Status>Real estate</Status></div><div className={styles.maiaRoute}>{points.map((point, index) => <div key={point}><span>{index + 1}</span><strong>{point}</strong></div>)}</div><div className={styles.maiaBottom}><div><Phone size={16} /><span>WhatsApp context retained</span></div><div><Database size={16} /><span>CRM record updated</span></div><div><Headphones size={16} /><span>Agent alerted</span></div></div></div>;
}

function ProcessVisual() {
  return <div className={styles.processVisual}><div><span>01</span><strong>Capture</strong></div><div><span>02</span><strong>Understand</strong></div><div><span>03</span><strong>Act</strong></div><div><span>04</span><strong>Coordinate</strong></div><div><span>05</span><strong>Improve</strong></div></div>;
}

function SendGlyph() {
  return <span className={styles.sendGlyph} aria-hidden="true">&#8599;</span>;
}

export default function FluxProductVisuals({ kind, className = "" }: ProductVisualProps) {
  const visual = { hero: <HeroVisual />, conversations: <ConversationVisual />, journey: <JourneyVisual />, operations: <OperationsVisual />, maia: <MaiaVisual />, process: <ProcessVisual /> }[kind];
  return <div className={`${styles.visual} ${className}`} role="img" aria-label={labels[kind]}>{visual}</div>;
}
