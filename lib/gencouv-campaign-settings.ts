import type { SupabaseClient } from "@supabase/supabase-js";
import { GENCOUV_CAMPAIGN_KEY, GencouvRequestError } from "@/lib/gencouv-admin";
export async function getGencouvCampaignSettings(db: SupabaseClient, organizationId: string) {
  const { data, error } = await db.from("gencouv_campaign_settings").select("sending_enabled,daily_send_limit,status,metadata").eq("organization_id", organizationId).eq("campaign_key", GENCOUV_CAMPAIGN_KEY).maybeSingle();
  if (error || !data) throw new GencouvRequestError("Campaign settings are temporarily unavailable.", 503);
  return { enabled: data.sending_enabled === true && data.status === "active", daily_limit: Number(data.daily_send_limit),
    manual_daily_limit: Number(data.metadata?.manual_daily_send_limit || 100), worker_verified: data.metadata?.outbound_worker_gate_verified === true,
    note: "Manual one-time sending is independent of automated campaign state. Already submitted email cannot be recalled." };
}
export async function updateGencouvCampaignSettings(db: SupabaseClient, organizationId: string, actor: string, enabled: boolean | null, dailyLimit: number | null) {
  if (dailyLimit !== null && (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000)) throw new GencouvRequestError("Daily limit must be an integer between 1 and 1,000.");
  const result = await db.rpc("gencouv_update_campaign_state", { p_organization_id: organizationId, p_enabled: enabled, p_daily_limit: dailyLimit, p_actor: actor });
  if (result.error) {
    if (String(result.error.message).includes("requires verification")) throw new GencouvRequestError("The connected automation worker must be verified to obey campaign OFF, permission and suppression checks before enabling it.", 409);
    throw new GencouvRequestError("Campaign settings could not be saved. No state change was confirmed.", 503);
  }
  return { ...await getGencouvCampaignSettings(db, organizationId), success: true, message: dailyLimit !== null && enabled === null ? "Daily limit saved. The automated campaign state was preserved." : enabled ? "Automated campaigns enabled." : "Automated campaigns are OFF. Manual one-time sending remains available." };
}
