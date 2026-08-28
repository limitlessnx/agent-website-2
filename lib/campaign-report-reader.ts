import { describeWhatsAppFailure, getRecentWhatsAppStatuses } from "@/lib/whatsapp-status-log";
import { reconcileLimitlessDeliveryLedger } from "@/lib/whatsapp-delivery-ledger";

export type CampaignRecipientStatus = {
  name: string;
  phone: string;
  message_id: string;
  status: string;
  error_code?: string;
  error_message?: string;
};

export type DetailedCampaignReport = {
  id: string;
  campaign_type: string;
  template_name: string;
  campaign_topic: string;
  status: string;
  attempted: number;
  accepted: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  pending_delivery: number;
  unresolved: number;
  final_status_note?: string;
  execution_id?: string;
  created_at: string;
  recipients: CampaignRecipientStatus[];
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

function parseContent(value: string | Record<string, unknown> | undefined) {
  try { return typeof value === "string" ? JSON.parse(value) as Record<string, unknown> : value || {}; }
  catch { return {}; }
}

export async function getDetailedCampaignReports(limit = 50): Promise<DetailedCampaignReport[]> {
  const { url, key } = config();
  if (!url || !key) return [];

  const [response, statusLogs] = await Promise.all([
    fetch(`${url}/rest/v1/bot_sessions?select=id,content,created_at&role=eq.whatsapp_campaign_context&order=created_at.desc&limit=${Math.max(200, Math.min(limit * 100, 5000))}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
    }),
    getRecentWhatsAppStatuses(5000),
    reconcileLimitlessDeliveryLedger(5000).catch((error) => console.error("Delivery ledger reconciliation failed.", error)),
  ]);
  if (!response.ok) {
    console.error("Unable to load detailed campaign reports.", await response.text().catch(() => ""));
    return [];
  }

  const statusByMessageId = new Map<string, (typeof statusLogs)[number]>();
  for (const log of statusLogs) {
    if (!log.message_id || statusByMessageId.has(log.message_id)) continue;
    statusByMessageId.set(log.message_id, log);
  }

  const rows = (await response.json()) as Array<{ id: string; content?: string | Record<string, unknown>; created_at?: string }>;
  const aggregateRows = rows
    .map((row) => ({ ...row, parsed: parseContent(row.content) }))
    .filter((row) => Array.isArray(row.parsed.accepted_recipients) || Array.isArray(row.parsed.failed_recipients) || Boolean(row.parsed.command_id))
    .slice(0, Math.max(1, Math.min(limit, 100)));

  return aggregateRows.map((row) => {
    const content = row.parsed;
    const acceptedRecipients = Array.isArray(content.accepted_recipients) ? content.accepted_recipients : [];
    const recipientStatuses: CampaignRecipientStatus[] = acceptedRecipients.map((recipient) => {
      const item = recipient as Record<string, unknown>;
      const id = String(item.messageId || item.message_id || "");
      const latest = statusByMessageId.get(id);
      return {
        name: String(item.name || "there"),
        phone: String(item.phone || item.recipient || ""),
        message_id: id,
        status: String(latest?.status || "accepted"),
        error_code: latest?.error_code || undefined,
        error_message: latest ? describeWhatsAppFailure(latest) : undefined,
      };
    });
    const finalFailed = recipientStatuses.filter((item) => item.status === "failed");
    const delivered = recipientStatuses.filter((item) => item.status === "delivered" || item.status === "read").length;
    const read = recipientStatuses.filter((item) => item.status === "read").length;
    const sent = recipientStatuses.filter((item) => item.status === "sent").length;
    const accepted = Number(content.accepted || content.sent || acceptedRecipients.length || 0);
    const immediateFailed = Number(content.failed || 0);
    const failed = immediateFailed + finalFailed.length;
    const resolved = recipientStatuses.filter((item) => item.status === "failed" || item.status === "delivered" || item.status === "read").length;
    const pending = Math.max(0, accepted - resolved);
    const unresolved = recipientStatuses.filter((item) => item.status === "accepted" || item.status === "sent" || !item.status).length + Math.max(0, accepted - recipientStatuses.length);
    const failureGroups = finalFailed.reduce((map, item) => {
      const code = item.error_code || "unknown";
      map.set(code, (map.get(code) || 0) + 1);
      return map;
    }, new Map<string, number>());
    const failureNote = [...failureGroups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([code, count]) => {
      const sample = finalFailed.find((item) => item.error_code === code);
      return `${count} ${sample?.error_message || describeWhatsAppFailure({ error_code: code })}`;
    }).join(" ");
    const status = failed > 0
      ? accepted > failed ? "partially_failed_after_acceptance" : "failed_after_acceptance"
      : delivered > 0 && pending === 0 ? "delivered"
      : unresolved > 0 ? "delivery_pending"
      : String(content.status || "sent");
    return {
      id: row.id,
      campaign_type: String(content.campaign_type || content.campaignType || "limitless_realty_update"),
      template_name: String(content.template_name || content.templateName || ""),
      campaign_topic: String(content.campaign_topic || content.topic || "WhatsApp campaign"),
      status,
      attempted: Number(content.attempted || 0),
      accepted,
      sent,
      delivered,
      read,
      failed,
      skipped: Number(content.skipped || 0),
      pending_delivery: pending,
      unresolved,
      final_status_note: failureNote || undefined,
      execution_id: content.execution_id ? String(content.execution_id) : undefined,
      created_at: row.created_at || String(content.created_at || ""),
      recipients: recipientStatuses,
    };
  });
}
