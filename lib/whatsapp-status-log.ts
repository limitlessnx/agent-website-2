export type WhatsAppStatusLog = {
  id: string;
  recipient_id: string;
  message_id: string;
  status: string;
  error_code: string;
  error_title: string;
  error_details: string;
  created_at: string;
};

export function describeWhatsAppFailure(status: Partial<WhatsAppStatusLog>) {
  const code = String(status.error_code || "");
  if (code === "131042") {
    return "Meta billing/payment issue. Settle the WhatsApp Business account payment before retrying campaigns.";
  }
  if (code === "131047") {
    return "Outside the 24-hour WhatsApp window. This contact must receive an approved template message.";
  }
  if (code === "131026") {
    return "Message undeliverable. Check that the number is valid, active on WhatsApp, and has not blocked the business.";
  }
  if (code === "131049") {
    return "Meta ecosystem delivery block. Slow down sends and use opted-in contacts before retrying this recipient.";
  }
  return status.error_details || status.error_title || "WhatsApp provider failure.";
}

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

function parseStatusContent(content: string | Record<string, unknown> | null | undefined) {
  try {
    return typeof content === "string" ? JSON.parse(content) as Record<string, unknown> : content || {};
  } catch {
    return {};
  }
}

export async function getRecentWhatsAppStatuses(limit = 1000): Promise<WhatsAppStatusLog[]> {
  const { url, key } = config();
  if (!url || !key) return [];

  const response = await fetch(
    `${url}/rest/v1/bot_sessions?select=id,user_id,content,created_at&role=eq.whatsapp_status&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 5000))}`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error("Unable to load WhatsApp status logs.", await response.text().catch(() => ""));
    return [];
  }

  const rows = (await response.json()) as Array<{
    id: string;
    user_id?: string;
    content?: string | Record<string, unknown>;
    created_at?: string;
  }>;

  return rows.map((row) => {
    const content = parseStatusContent(row.content);
    return {
      id: row.id,
      recipient_id: String(content.recipient_id || row.user_id || ""),
      message_id: String(content.message_id || content.whatsapp_message_id || ""),
      status: String(content.status || content.whatsapp_status || "").toLowerCase(),
      error_code: String(content.error_code || content.whatsapp_error_code || ""),
      error_title: String(content.error_title || content.whatsapp_error_title || ""),
      error_details: String(content.error_details || content.whatsapp_error_details || ""),
      created_at: row.created_at || String(content.created_at || ""),
    };
  }).filter((row) => row.recipient_id || row.message_id);
}

export async function getMetaCooldownPhones(phones: string[], hours = 24) {
  const phoneSet = new Set(phones.map((phone) => phone.replace(/[^\d]/g, "")).filter(Boolean));
  if (!phoneSet.size) return new Map<string, WhatsAppStatusLog>();

  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const cooldowns = new Map<string, WhatsAppStatusLog>();
  const statuses = await getRecentWhatsAppStatuses(1500);

  for (const status of statuses) {
    const phone = status.recipient_id.replace(/[^\d]/g, "");
    if (!phoneSet.has(phone) || cooldowns.has(phone)) continue;
    const createdAt = Date.parse(status.created_at || "");
    if (!Number.isFinite(createdAt) || createdAt < cutoff) continue;
    if (status.status === "failed" && status.error_code === "131049") {
      cooldowns.set(phone, status);
    }
  }

  return cooldowns;
}
