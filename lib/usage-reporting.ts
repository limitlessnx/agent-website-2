import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type UsageMetricKey =
  | "conversations"
  | "messages"
  | "leadsCaptured"
  | "qualifiedLeads"
  | "successfulActions"
  | "failedActions"
  | "handoffs"
  | "whatsappMessages"
  | "emailsSent";

export type UsageTrend = {
  current: number;
  previous: number;
  changePercent: number | null;
};

export type OrganizationValueReport = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  previousPeriodStart: string;
  metrics: {
    conversations: UsageTrend;
    messages: UsageTrend;
    leadsCaptured: UsageTrend;
    qualifiedLeads: UsageTrend;
    successfulActions: UsageTrend;
    failedActions: UsageTrend;
    handoffs: UsageTrend;
    whatsappMessages: UsageTrend;
    emailsSent: UsageTrend;
    emailsDelivered: number;
    emailsOpened: number;
    emailsClicked: number;
    emailsFailed: number;
    activeAgents: number;
    successRate: number | null;
    estimatedTimeSavedMinutes: number | null;
  };
  usageByType: Record<string, number>;
  topChannel: string | null;
  lastActivityAt: string | null;
  trackingCoverage: Array<{
    source: string;
    tracked: boolean;
    recordCount: number;
  }>;
  hasOperationalData: boolean;
};

type OrganizationRow = { id: string; name: string; slug: string; status: string };
type ConversationRow = { organization_id: string; channel: string; created_at: string; last_message_at?: string | null };
type MessageRow = { organization_id: string; created_at: string };
type LeadRow = { organization_id: string; stage: string; created_at: string; updated_at?: string };
type ExecutionRow = { organization_id: string; status: string; created_at: string; completed_at?: string | null };
type ToolCallRow = { organization_id: string; status: string; created_at: string; completed_at?: string | null };
type HandoffRow = { organization_id: string; created_at: string };
type UsageLedgerRow = { organization_id: string; usage_type: string; quantity: number | string; metadata?: Record<string, unknown>; occurred_at: string };
type AgentRow = { organization_id: string; status: string };
type WhatsAppRow = { organization_id: string; status: string; created_at: string };
type EmailRow = {
  organization_id: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  failed_at: string | null;
  created_at: string;
};

const MAX_ROWS = 5000;

async function safeRead<T>(path: string): Promise<T[]> {
  try {
    return await supabaseServerRequest<T[]>(path);
  } catch (error) {
    console.error("Usage reporting source unavailable", path, error);
    return [];
  }
}

function isoDaysAgo(days: number, from = new Date()) {
  return new Date(from.getTime() - days * 86_400_000).toISOString();
}

function inRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}

function trend(current: number, previous: number): UsageTrend {
  return {
    current,
    previous,
    changePercent: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null,
  };
}

function countPeriod<T>(rows: T[], getDate: (row: T) => string | null | undefined, start: Date, end: Date) {
  return rows.filter((row) => inRange(getDate(row), start, end)).length;
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const valid = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => b.time - a.time);
  return valid[0]?.value ?? null;
}

function numeric(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimatedTimeSaved(rows: UsageLedgerRow[]) {
  let total = 0;
  let measured = false;
  for (const row of rows) {
    const metadata = row.metadata || {};
    const candidate = metadata.time_saved_minutes ?? metadata.estimated_time_saved_minutes;
    if (candidate !== undefined && candidate !== null) {
      measured = true;
      total += numeric(candidate);
    }
  }
  return measured ? Math.round(total) : null;
}

function orgTextMatch(value: string, organization: OrganizationRow) {
  return value === organization.id || value === organization.slug;
}

export async function getOrganizationValueReports(periodDays = 30): Promise<OrganizationValueReport[]> {
  const now = new Date();
  const periodStart = new Date(isoDaysAgo(periodDays, now));
  const previousPeriodStart = new Date(isoDaysAgo(periodDays * 2, now));
  const queryStart = encodeURIComponent(previousPeriodStart.toISOString());

  const [
    organizations,
    conversations,
    messages,
    leads,
    executions,
    toolCalls,
    handoffs,
    usage,
    agents,
    whatsapp,
    emails,
  ] = await Promise.all([
    safeRead<OrganizationRow>("organizations?select=id,name,slug,status&status=eq.active&order=name.asc&limit=200"),
    safeRead<ConversationRow>(`agent_conversations?select=organization_id,channel,created_at,last_message_at&created_at=gte.${queryStart}&limit=${MAX_ROWS}`),
    safeRead<MessageRow>(`conversation_messages?select=organization_id,created_at&created_at=gte.${queryStart}&limit=${MAX_ROWS}`),
    safeRead<LeadRow>(`crm_leads?select=organization_id,stage,created_at,updated_at&created_at=gte.${queryStart}&limit=${MAX_ROWS}`),
    safeRead<ExecutionRow>(`runtime_executions?select=organization_id,status,created_at,completed_at&created_at=gte.${queryStart}&limit=${MAX_ROWS}`),
    safeRead<ToolCallRow>(`runtime_tool_calls?select=organization_id,status,created_at,completed_at&created_at=gte.${queryStart}&limit=${MAX_ROWS}`),
    safeRead<HandoffRow>(`handoff_requests?select=organization_id,created_at&created_at=gte.${queryStart}&limit=${MAX_ROWS}`),
    safeRead<UsageLedgerRow>(`usage_ledger?select=organization_id,usage_type,quantity,metadata,occurred_at&occurred_at=gte.${queryStart}&limit=${MAX_ROWS}`),
    safeRead<AgentRow>("agents?select=organization_id,status&limit=1000"),
    safeRead<WhatsAppRow>(`whatsapp_delivery_attempts?select=organization_id,status,created_at&created_at=gte.${queryStart}&limit=${MAX_ROWS}`),
    safeRead<EmailRow>(`gencouv_email_messages?select=organization_id,sent_at,delivered_at,opened_at,clicked_at,failed_at,created_at&created_at=gte.${queryStart}&limit=${MAX_ROWS}`),
  ]);

  return organizations.map((organization) => {
    const orgConversations = conversations.filter((row) => row.organization_id === organization.id);
    const orgMessages = messages.filter((row) => row.organization_id === organization.id);
    const orgLeads = leads.filter((row) => row.organization_id === organization.id);
    const orgExecutions = executions.filter((row) => row.organization_id === organization.id);
    const orgToolCalls = toolCalls.filter((row) => row.organization_id === organization.id);
    const orgHandoffs = handoffs.filter((row) => row.organization_id === organization.id);
    const orgUsage = usage.filter((row) => row.organization_id === organization.id);
    const orgAgents = agents.filter((row) => row.organization_id === organization.id);
    const orgWhatsapp = whatsapp.filter((row) => orgTextMatch(row.organization_id, organization));
    const orgEmails = emails.filter((row) => row.organization_id === organization.id);

    const currentConversations = countPeriod(orgConversations, (row) => row.created_at, periodStart, now);
    const previousConversations = countPeriod(orgConversations, (row) => row.created_at, previousPeriodStart, periodStart);
    const currentMessages = countPeriod(orgMessages, (row) => row.created_at, periodStart, now);
    const previousMessages = countPeriod(orgMessages, (row) => row.created_at, previousPeriodStart, periodStart);
    const currentLeads = countPeriod(orgLeads, (row) => row.created_at, periodStart, now);
    const previousLeads = countPeriod(orgLeads, (row) => row.created_at, previousPeriodStart, periodStart);

    const qualifiedStages = new Set(["qualified", "appointment", "won"]);
    const currentQualified = orgLeads.filter((row) => qualifiedStages.has(row.stage) && inRange(row.created_at, periodStart, now)).length;
    const previousQualified = orgLeads.filter((row) => qualifiedStages.has(row.stage) && inRange(row.created_at, previousPeriodStart, periodStart)).length;

    const currentSuccessfulExecutions = orgExecutions.filter((row) => row.status === "succeeded" && inRange(row.created_at, periodStart, now)).length;
    const previousSuccessfulExecutions = orgExecutions.filter((row) => row.status === "succeeded" && inRange(row.created_at, previousPeriodStart, periodStart)).length;
    const currentSuccessfulTools = orgToolCalls.filter((row) => row.status === "succeeded" && inRange(row.created_at, periodStart, now)).length;
    const previousSuccessfulTools = orgToolCalls.filter((row) => row.status === "succeeded" && inRange(row.created_at, previousPeriodStart, periodStart)).length;
    const currentFailedExecutions = orgExecutions.filter((row) => row.status === "failed" && inRange(row.created_at, periodStart, now)).length;
    const previousFailedExecutions = orgExecutions.filter((row) => row.status === "failed" && inRange(row.created_at, previousPeriodStart, periodStart)).length;
    const currentFailedTools = orgToolCalls.filter((row) => row.status === "failed" && inRange(row.created_at, periodStart, now)).length;
    const previousFailedTools = orgToolCalls.filter((row) => row.status === "failed" && inRange(row.created_at, previousPeriodStart, periodStart)).length;

    const currentSuccessfulActions = currentSuccessfulExecutions + currentSuccessfulTools;
    const previousSuccessfulActions = previousSuccessfulExecutions + previousSuccessfulTools;
    const currentFailedActions = currentFailedExecutions + currentFailedTools;
    const previousFailedActions = previousFailedExecutions + previousFailedTools;

    const currentHandoffs = countPeriod(orgHandoffs, (row) => row.created_at, periodStart, now);
    const previousHandoffs = countPeriod(orgHandoffs, (row) => row.created_at, previousPeriodStart, periodStart);

    const successfulWhatsappStatuses = new Set(["accepted", "sent", "delivered", "read"]);
    const currentWhatsapp = orgWhatsapp.filter((row) => successfulWhatsappStatuses.has(row.status) && inRange(row.created_at, periodStart, now)).length;
    const previousWhatsapp = orgWhatsapp.filter((row) => successfulWhatsappStatuses.has(row.status) && inRange(row.created_at, previousPeriodStart, periodStart)).length;

    const currentEmailRows = orgEmails.filter((row) => inRange(row.created_at, periodStart, now));
    const previousEmailRows = orgEmails.filter((row) => inRange(row.created_at, previousPeriodStart, periodStart));
    const emailsSent = currentEmailRows.filter((row) => Boolean(row.sent_at)).length;
    const previousEmailsSent = previousEmailRows.filter((row) => Boolean(row.sent_at)).length;

    const currentUsage = orgUsage.filter((row) => inRange(row.occurred_at, periodStart, now));
    const usageByType = currentUsage.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.usage_type] = (accumulator[row.usage_type] || 0) + numeric(row.quantity);
      return accumulator;
    }, {});

    const channelCounts = orgConversations
      .filter((row) => inRange(row.created_at, periodStart, now))
      .reduce<Record<string, number>>((accumulator, row) => {
        accumulator[row.channel] = (accumulator[row.channel] || 0) + 1;
        return accumulator;
      }, {});
    const topChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const actionAttempts = currentSuccessfulActions + currentFailedActions;
    const successRate = actionAttempts > 0 ? Math.round((currentSuccessfulActions / actionAttempts) * 1000) / 10 : null;

    const lastActivityAt = latestTimestamp([
      ...orgConversations.flatMap((row) => [row.last_message_at, row.created_at]),
      ...orgMessages.map((row) => row.created_at),
      ...orgExecutions.flatMap((row) => [row.completed_at, row.created_at]),
      ...orgToolCalls.flatMap((row) => [row.completed_at, row.created_at]),
      ...orgHandoffs.map((row) => row.created_at),
      ...orgUsage.map((row) => row.occurred_at),
      ...orgWhatsapp.map((row) => row.created_at),
      ...orgEmails.map((row) => row.created_at),
    ]);

    const trackingCoverage = [
      { source: "Conversations", tracked: true, recordCount: orgConversations.length },
      { source: "Runtime actions", tracked: true, recordCount: orgExecutions.length + orgToolCalls.length },
      { source: "CRM leads", tracked: true, recordCount: orgLeads.length },
      { source: "Usage ledger", tracked: true, recordCount: orgUsage.length },
      { source: "Human handoffs", tracked: true, recordCount: orgHandoffs.length },
      { source: "WhatsApp delivery", tracked: true, recordCount: orgWhatsapp.length },
      { source: "Email delivery", tracked: true, recordCount: orgEmails.length },
    ];

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      periodDays,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      previousPeriodStart: previousPeriodStart.toISOString(),
      metrics: {
        conversations: trend(currentConversations, previousConversations),
        messages: trend(currentMessages, previousMessages),
        leadsCaptured: trend(currentLeads, previousLeads),
        qualifiedLeads: trend(currentQualified, previousQualified),
        successfulActions: trend(currentSuccessfulActions, previousSuccessfulActions),
        failedActions: trend(currentFailedActions, previousFailedActions),
        handoffs: trend(currentHandoffs, previousHandoffs),
        whatsappMessages: trend(currentWhatsapp, previousWhatsapp),
        emailsSent: trend(emailsSent, previousEmailsSent),
        emailsDelivered: currentEmailRows.filter((row) => Boolean(row.delivered_at)).length,
        emailsOpened: currentEmailRows.filter((row) => Boolean(row.opened_at)).length,
        emailsClicked: currentEmailRows.filter((row) => Boolean(row.clicked_at)).length,
        emailsFailed: currentEmailRows.filter((row) => Boolean(row.failed_at)).length,
        activeAgents: orgAgents.filter((row) => row.status === "published").length,
        successRate,
        estimatedTimeSavedMinutes: estimatedTimeSaved(currentUsage),
      },
      usageByType,
      topChannel,
      lastActivityAt,
      trackingCoverage,
      hasOperationalData: Boolean(
        currentConversations || currentMessages || currentLeads || currentSuccessfulActions || currentHandoffs || currentWhatsapp || emailsSent || currentUsage.length,
      ),
    } satisfies OrganizationValueReport;
  }).sort((a, b) => {
    if (a.hasOperationalData !== b.hasOperationalData) return a.hasOperationalData ? -1 : 1;
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bTime - aTime || a.organizationName.localeCompare(b.organizationName);
  });
}
