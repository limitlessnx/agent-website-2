export type DetailedCampaignReport = {
  id: string;
  campaign_topic: string;
  status: string;
  attempted: number;
  accepted: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  pending_delivery: number;
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

  const response = await fetch(
    `${url}/rest/v1/bot_sessions?select=id,content,created_at&role=eq.whatsapp_campaign_context&order=created_at.desc&limit=${limit}`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    console.error("Unable to load detailed campaign reports.", await response.text().catch(() => ""));
    return [];
  }

  const rows = (await response.json()) as Array<{ id: string; content?: string | Record<string, unknown>; created_at?: string }>;
  return rows.map((row) => {
    let content: Record<string, unknown> = {};
    try { content = typeof row.content === "string" ? JSON.parse(row.content) : row.content || {}; } catch {}
    return {
      id: row.id,
      campaign_topic: String(content.campaign_topic || content.topic || "WhatsApp campaign"),
      status: String(content.status || (Number(content.failed || 0) ? "partially_sent" : "sent")),
      attempted: Number(content.attempted || 0),
      accepted: Number(content.accepted || content.sent || 0),
      delivered: Number(content.delivered || 0),
      read: Number(content.read || 0),
      failed: Number(content.failed || 0),
      skipped: Number(content.skipped || 0),
      pending_delivery: Number(content.pending_delivery || content.pendingDelivery || 0),
      execution_id: content.execution_id ? String(content.execution_id) : undefined,
      created_at: row.created_at || String(content.created_at || ""),
    };
  });
}
