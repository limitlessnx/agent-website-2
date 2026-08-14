import type { CSSProperties } from "react";
import Link from "next/link";
import { CalendarDays, Flame, MessageSquareText, PhoneCall, TrendingUp, Users } from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import { getCampaignReports } from "@/lib/limitless-data";
import styles from "./DailyBriefs.module.css";

type PageProps = {
  searchParams?: Promise<{ date?: string }>;
};

type LeadRow = {
  id?: string;
  name?: string;
  full_name?: string;
  client_name?: string;
  profile_name?: string;
  phone?: string;
  whatsapp?: string;
  whatsapp_id?: string;
  from?: string;
  status?: string;
  lead_status?: string;
  score?: string;
  lead_score?: string;
  budget?: string;
  price_range?: string;
  location_preference?: string;
  preferred_location?: string;
  property_type?: string;
  purpose?: string;
  follow_up_stage?: number;
  last_contacted_at?: string;
  last_follow_up_at?: string;
  created_at?: string;
  conversation_log?: string | ConversationMessage[];
  current_message?: string;
  last_message?: string;
  conversation_summary?: string;
  selected_property?: string;
  property_name?: string;
  interested_property?: string;
  property_interest?: string;
};

type ConversationMessage = {
  role?: string;
  content?: string;
  message?: string;
  timestamp?: string;
  created_at?: string;
};

type DailyLeadCandle = {
  date: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  newLeads: number;
  activeChats: number;
};

type DailyBriefClientSummary = {
  id: string;
  name: string;
  phone: string;
  status: string;
  score: string;
  budget: string;
  location: string;
  propertyInterest: string;
  lastMessage: string;
  action: string;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value?: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : todayKey();
}

function supabaseConfig() {
  const url =
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  return { url: url.replace(/\/$/, ""), key };
}

async function supabaseFetch<T>(table: string, query: string): Promise<T[]> {
  const { url, key } = supabaseConfig();
  if (!url || !key) return [];
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) return [];
  return (await response.json()) as T[];
}

async function getDailyLeads() {
  const queries = [
    "?select=*&order=updated_at.desc.nullslast&limit=1000",
    "?select=*&order=created_at.desc.nullslast&limit=1000",
    "?select=*&limit=1000",
  ];

  for (const query of queries) {
    const rows = await supabaseFetch<LeadRow>("leads", query);
    if (rows.length) return rows;
  }

  return [];
}

function leadValue(lead: LeadRow, ...keys: (keyof LeadRow)[]) {
  return keys.map((key) => String(lead[key] || "").trim()).find(Boolean) || "";
}

function dateKey(value?: string) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : "";
}

function addDays(date: string, days: number) {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function parseConversationLog(value: LeadRow["conversation_log"]): ConversationMessage[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function compactText(value: string, maxLength = 190) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function detectPropertyInterest(lead: LeadRow, log: ConversationMessage[]) {
  const direct = leadValue(lead, "selected_property", "property_name", "interested_property", "property_interest");
  if (direct) return direct;

  const text = [
    lead.current_message,
    lead.last_message,
    lead.conversation_summary,
    ...log.slice(-12).map((message) => message.content || message.message || ""),
  ].join(" ");

  const patterns = [
    /\b(Iwinosa(?:\s+Mega\s+City|\s+Estate)?)\b/i,
    /\b(Atlanta\s+City(?:\s+Estate)?(?:\s+Phase\s+\d+)?)\b/i,
    /\b(Landsmith\s+(?:Crest|Pearl|Crystal|Atlanta))\b/i,
    /\b(Wealthy\s+Park(?:\s+Estate)?)\b/i,
    /\b(Idu\s+London\s+Estate)\b/i,
    /\b(Obodoma\s+Estate)\b/i,
    /\b(Urban\s+View\s+Estate)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, " ").trim();
  }

  return "Not specified";
}

function messageText(message: ConversationMessage) {
  return String(message.content || message.message || "").trim();
}

function leadHadActivityOnDate(lead: LeadRow, log: ConversationMessage[], date: string) {
  if ([lead.created_at, lead.last_contacted_at, lead.last_follow_up_at].some((value) => dateKey(value) === date)) {
    return true;
  }
  return log.some((message) => dateKey(message.timestamp || message.created_at) === date);
}

function latestClientMessageForDate(lead: LeadRow, log: ConversationMessage[], date: string) {
  const dated = log
    .filter((message) => dateKey(message.timestamp || message.created_at) === date)
    .filter((message) => messageText(message))
    .slice(-5);
  const latestUser = [...dated].reverse().find((message) => String(message.role || "").toLowerCase() === "user");
  return compactText(messageText(latestUser || dated[dated.length - 1] || { content: lead.current_message || lead.last_message || "" }), 180);
}

function briefAction(lead: LeadRow, latestMessage: string) {
  const text = `${latestMessage} ${lead.conversation_summary || ""}`.toLowerCase();
  if (/view|inspection|site visit|book/.test(text)) return "Confirm inspection request and call client.";
  if (/price|payment|installment|pay/.test(text)) return "Send payment/title details or call to explain payment options.";
  if (/image|photo|picture|flyer|brochure/.test(text)) return "Confirm the property media link is available.";
  if (["hot", "qualified"].includes(leadValue(lead, "score", "status").toLowerCase())) return "Call this qualified lead today.";
  return "Review chat and continue qualification.";
}

function buildLeadSummary(lead: LeadRow, date: string): DailyBriefClientSummary {
  const log = parseConversationLog(lead.conversation_log);
  const latestMessage = latestClientMessageForDate(lead, log, date);

  return {
    id: leadValue(lead, "id", "phone", "whatsapp_id") || `${leadValue(lead, "name", "profile_name")}-${date}`,
    name: leadValue(lead, "name", "full_name", "client_name", "profile_name") || "Unknown",
    phone: leadValue(lead, "phone", "whatsapp", "whatsapp_id", "from") || "-",
    status: leadValue(lead, "status", "lead_status") || "new",
    score: leadValue(lead, "score", "lead_score") || "unscored",
    budget: leadValue(lead, "budget", "price_range") || "Not provided",
    location: leadValue(lead, "location_preference", "preferred_location") || "Not provided",
    propertyInterest: detectPropertyInterest(lead, log),
    lastMessage: latestMessage || "No message text captured for this date.",
    action: briefAction(lead, latestMessage),
  };
}

function followUpDue(lead: LeadRow, date: string) {
  const stage = Number(lead.follow_up_stage || 0);
  if (!Number.isFinite(stage) || stage >= 4) return false;
  const anchor = stage === 0 ? lead.last_contacted_at || lead.created_at : lead.last_follow_up_at || lead.last_contacted_at || lead.created_at;
  if (!anchor) return false;
  const delayDays = [1, 3, 7, 14][stage] || 1;
  const anchorDate = dateKey(anchor);
  if (!anchorDate) return false;
  return addDays(anchorDate, delayDays) <= date;
}

function buildCandles(leads: LeadRow[], selectedDate: string) {
  const start = addDays(selectedDate, -13);
  const days = Array.from({ length: 14 }, (_, index) => addDays(start, index));
  return days.map((date): DailyLeadCandle => {
    const prior = leads.filter((lead) => dateKey(lead.created_at) < date).length;
    const createdToday = leads.filter((lead) => dateKey(lead.created_at) === date).length;
    const activeChats = leads.filter((lead) => leadHadActivityOnDate(lead, parseConversationLog(lead.conversation_log), date)).length;
    const open = prior;
    const close = prior + createdToday;
    const high = Math.max(open, close) + activeChats;
    const low = Math.max(0, Math.min(open, close) - Math.floor(activeChats / 2));
    return {
      date,
      label: new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      open,
      high,
      low,
      close,
      newLeads: createdToday,
      activeChats,
    };
  });
}

async function getDailyBrief(date: string) {
  const [leads, campaigns] = await Promise.all([getDailyLeads(), getCampaignReports(100)]);
  const clientSummaries = leads
    .filter((lead) => leadHadActivityOnDate(lead, parseConversationLog(lead.conversation_log), date))
    .map((lead) => buildLeadSummary(lead, date))
    .sort((a, b) => {
      const aPriority = ["hot", "qualified"].includes(a.score.toLowerCase()) || a.status.toLowerCase() === "qualified" ? 1 : 0;
      const bPriority = ["hot", "qualified"].includes(b.score.toLowerCase()) || b.status.toLowerCase() === "qualified" ? 1 : 0;
      return bPriority - aPriority;
    });

  const newLeads = leads.filter((lead) => dateKey(lead.created_at) === date).length;
  const hotLeads = leads.filter((lead) => leadValue(lead, "score").toLowerCase() === "hot").length;
  const qualifiedLeads = leads.filter((lead) => leadValue(lead, "status", "lead_status").toLowerCase() === "qualified").length;
  const followUpsDue = leads.filter((lead) => followUpDue(lead, date)).length;
  const campaignCount = campaigns.filter((campaign) => dateKey(campaign.created_at) === date).length;
  const imageRequests = clientSummaries.filter((client) => /image|photo|picture|flyer|brochure/i.test(client.lastMessage)).length;
  const inspectionRequests = clientSummaries.filter((client) => /view|inspection|site visit|book/i.test(client.lastMessage)).length;

  return {
    date,
    totalLeads: leads.length,
    newLeads,
    activeChats: clientSummaries.length,
    hotLeads,
    qualifiedLeads,
    followUpsDue,
    campaignCount,
    clientSummaries,
    candles: buildCandles(leads, date),
    highlights: [
      `${newLeads} new lead${newLeads === 1 ? "" : "s"} entered the system.`,
      `${clientSummaries.length} WhatsApp client conversation${clientSummaries.length === 1 ? "" : "s"} had activity.`,
      `${followUpsDue} lead${followUpsDue === 1 ? "" : "s"} appear due for follow-up review.`,
      `${campaignCount} WhatsApp campaign context item${campaignCount === 1 ? "" : "s"} recorded.`,
    ],
    actionItems: [
      inspectionRequests ? `${inspectionRequests} client${inspectionRequests === 1 ? "" : "s"} mentioned viewing/inspection.` : "",
      imageRequests ? `${imageRequests} client${imageRequests === 1 ? "" : "s"} asked about media/images.` : "",
      followUpsDue ? "Review due follow-ups before the next automatic sequence run." : "",
      clientSummaries.length ? "Open the client summaries below and prioritize hot or qualified contacts." : "No WhatsApp client chat activity was captured for this date.",
    ].filter(Boolean),
  };
}

function CandleChart({ candles }: { candles: DailyLeadCandle[] }) {
  const max = Math.max(1, ...candles.map((candle) => candle.high));

  return (
    <div className={styles.candleChart} aria-label="Lead candlestick chart">
      {candles.map((candle) => {
        const high = Math.max(candle.high, candle.open, candle.close);
        const low = Math.min(candle.low, candle.open, candle.close);
        const top = 100 - (high / max) * 100;
        const bottom = (low / max) * 100;
        const bodyHigh = Math.max(candle.open, candle.close);
        const bodyLow = Math.min(candle.open, candle.close);
        const bodyTop = 100 - (bodyHigh / max) * 100;
        const bodyBottom = (bodyLow / max) * 100;
        const isUp = candle.close >= candle.open;
        const style = {
          "--wick-top": `${top}%`,
          "--wick-bottom": `${bottom}%`,
          "--body-top": `${bodyTop}%`,
          "--body-bottom": `${bodyBottom}%`,
        } as CSSProperties;

        return (
          <div key={candle.date} className={styles.candleSlot} style={style} title={`${candle.date}: ${candle.newLeads} new leads, ${candle.activeChats} active chats`}>
            <div className={styles.candleTrack}>
              <span className={styles.candleWick} />
              <span className={`${styles.candleBody} ${isUp ? styles.up : styles.down}`} />
            </div>
            <strong>{candle.newLeads}</strong>
            <em>{candle.label}</em>
          </div>
        );
      })}
    </div>
  );
}

export default async function DailyBriefsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedDate = normalizeDate(params?.date);
  const brief = await getDailyBrief(selectedDate);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Daily Briefs</h1>
          <p>Daily lead totals, WhatsApp client summaries, campaign activity, and follow-up attention points.</p>
        </div>
        <form className={styles.dateForm}>
          <label>
            <CalendarDays size={16} />
            <input type="date" name="date" defaultValue={brief.date} />
          </label>
          <button type="submit">View day</button>
        </form>
      </div>

      <div className="admin-metric-grid">
        <MetricCard label="Total leads" value={brief.totalLeads} detail="All-time lead records" icon={Users} tone="cyan" />
        <MetricCard label="New leads" value={brief.newLeads} detail={brief.date} icon={TrendingUp} tone="emerald" />
        <MetricCard label="WhatsApp chats" value={brief.activeChats} detail="Client activity captured" icon={MessageSquareText} tone="violet" />
        <MetricCard label="Hot / qualified" value={brief.hotLeads + brief.qualifiedLeads} detail={`${brief.followUpsDue} follow-ups due`} icon={Flame} tone="amber" />
      </div>

      <section className={`admin-panel ${styles.panel}`}>
        <div className="admin-panel-header">
          <div>
            <h2>Lead Candles</h2>
            <p>Candles show total lead movement. Number above each candle is new leads for that day.</p>
          </div>
          <span className="admin-status live">14-day view</span>
        </div>
        <CandleChart candles={brief.candles} />
      </section>

      <div className="admin-grid two">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Daily Highlights</h2>
            <p>Operational summary for {brief.date}.</p>
          </div>
          <div className="admin-checklist upgraded">
            {brief.highlights.map((highlight) => (
              <span key={highlight}><span className="dot cyan" />{highlight}</span>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Action Items</h2>
            <p>What needs attention from today&apos;s conversations.</p>
          </div>
          <div className="admin-checklist upgraded">
            {brief.actionItems.map((item) => (
              <span key={item}><span className="dot amber" />{item}</span>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>WhatsApp Client Summary</h2>
            <p>{brief.clientSummaries.length} client conversation{brief.clientSummaries.length === 1 ? "" : "s"} found for this day.</p>
          </div>
          <Link href="/dashboard/limitless/leads" className="admin-outline-link">Open leads</Link>
        </div>

        {brief.clientSummaries.length ? (
          <div className={styles.clientList}>
            {brief.clientSummaries.map((client) => (
              <article key={client.id} className={styles.clientCard}>
                <div className={styles.clientHead}>
                  <span className="admin-avatar">{client.name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{client.name}</strong>
                    <p>{client.phone}</p>
                  </div>
                  <em>{client.score}</em>
                </div>
                <div className={styles.clientMeta}>
                  <span>{client.status}</span>
                  <span>{client.propertyInterest}</span>
                  <span>{client.budget}</span>
                  <span>{client.location}</span>
                </div>
                <p className={styles.clientMessage}>{client.lastMessage}</p>
                <div className={styles.clientAction}>
                  <PhoneCall size={15} />
                  <span>{client.action}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty-state">
            <strong>No WhatsApp client summaries for this date.</strong>
            <p>Select another day, or confirm WhatsApp conversation logs are being saved on leads.</p>
          </div>
        )}
      </section>
    </div>
  );
}
