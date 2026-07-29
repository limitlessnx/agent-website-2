export type CampaignDeliveryReport = {
  id: string;
  campaign_type?: string;
  template_name?: string;
  campaign_topic: string;
  command_id: string;
  execution_id?: string;
  status: string;
  attempted: number;
  accepted: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  pending_delivery: number;
  accepted_recipients?: unknown[];
  failed_recipients?: unknown[];
  workflow_path?: string[];
  created_by?: string;
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

export async function saveCampaignDeliveryReport(report: CampaignDeliveryReport) {
  const { url, key } = config();
  if (!url || !key) return false;

  const response = await fetch(`${url}/rest/v1/bot_sessions`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: report.id,
      user_id: report.created_by || "fluxknight_admin",
      role: "whatsapp_campaign_context",
      content: JSON.stringify(report),
      created_at: report.created_at,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Campaign report persistence failed: ${response.status} ${detail}`);
    return false;
  }
  return true;
}
