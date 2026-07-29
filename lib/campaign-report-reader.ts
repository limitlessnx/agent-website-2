import { getRecentWhatsAppStatuses } from "@/lib/whatsapp-status-log";

export type DetailedCampaignReport = {
  id: string;
  campaign_type: string;
  template_name: string;
  campaign_topic: string;
  status: string;
  attempted: number;
  accepted: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  pending_delivery: number;
  final_status_note?: string;
  execution_id?: string;
  created_at: string;
};

function config() {
  const url = (
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";
  return { url, key };
}

export async function getDetailedCampaignReports(limit = 50): Promise<DetailedCampaignReport[]> {
  const { url, key } = config();
  if (!url || !key) return [];

  const [response, statusLogs] = await Promise.all([fetch(
    `${url}/rest/v1/bot_sessions?select=id,content,created_at&role=eq.whatsapp_campaign_context&order=created_at.desc&limit=${limit}`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
    },
  ), getRecentWhatsAppStatuses(1500)]);
  if (!response.ok) {
    console.error("Unable to load detailed campaign reports.", await response.text().catch(() => ""));
    return [];
  }

  const statusByMessageId = new Map(statusLogs.filter((log) => log.message_id).map((log) => [log.message_id, log]));
  const rows = (await response.json()) as Array<{ id: string; content?: string | Record<string, unknown>; created_at?: string }>;
  return rows.map((row) => {
    let content: Record<string, unknown> = {};
    try { content = typeof row.content === "string" ? JSON.parse(row.content) : row.content || {}; } catch {}
    const acceptedRecipients = Array.isArray(content.accepted_recipients) ? content.accepted_recipients : [];
    const finalStatuses = acceptedRecipients
      .map((recipient) => {
        const item = recipient as Record<string, unknown>;
        return statusByMessageId.get(String(item.messageId || item.message_id || ""));
      })
      .filter(Boolean);
    const finalFailed = finalStatuses.filter((status) => status?.status === "failed");
    const resolvedStatuses = finalStatuses.filter((status) =>
      status?.status === "failed" || status?.status === "delivered" || status?.status === "read",
    );
    const delivered = finalStatuses.filter((status) => status?.status === "delivered" || status?.status === "read").length;
    const read = finalStatuses.filter((status) => status?.status === "read").length;
    const accepted = Number(content.accepted || content.sent || 0);
    const immediateFailed = Number(content.failed || 0);
    const failed = immediateFailed + finalFailed.length;
    const pending = Math.max(0, Number(content.pending_delivery || content.pendingDelivery || 0) - resolvedStatuses.length);
    const ecosystemBlocks = finalFailed.filter((status) => status?.error_code === "131049").length;
    const status = finalFailed.length
      ? accepted > finalFailed.length ? "partially_failed_after_acceptance" : "failed_after_acceptance"
      : delivered > 0 && pending === 0 ? "delivered" : String(content.status || (failed ? "partially_sent" : "sent"));
    return {
      id: row.id,
      campaign_type: String(content.campaign_type || content.campaignType || "limitless_realty_update"),
      template_name: String(content.template_name || content.templateName || ""),
      campaign_topic: String(content.campaign_topic || content.topic || "WhatsApp campaign"),
      status,
      attempted: Number(content.attempted || 0),
      accepted,
      delivered,
      read,
      failed,
      skipped: Number(content.skipped || 0),
      pending_delivery: pending,
      final_status_note: ecosystemBlocks
        ? `${ecosystemBlocks} blocked by Meta ecosystem delivery control`
        : finalFailed[0]?.error_details || undefined,
      execution_id: content.execution_id ? String(content.execution_id) : undefined,
      created_at: row.created_at || String(content.created_at || ""),
    };
  });
}
