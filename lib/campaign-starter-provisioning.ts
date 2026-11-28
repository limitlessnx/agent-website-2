import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTenantWhatsAppCredentials } from "@/lib/whatsapp-credentials";
import { loadLinkedCampaignTemplates, CampaignTemplateError } from "@/lib/portal-campaign-templates";
import { CAMPAIGN_STARTER_VERSION, campaignStarters, starterMatches, starterMetaPayload } from "@/lib/campaign-starter-templates";

/** Explicit setup only. Never overwrites an existing mapping, even if paused.
 * Only an exact live APPROVED starter contract may be registered as active. */
export async function prepareCampaignStarters(organizationId: string, hotel: boolean, submitMissing: boolean) {
  const admin = createAdminClient();
  const credentials = await resolveTenantWhatsAppCredentials(admin, organizationId, { inventory: true });
  if (credentials.providerFamily !== "meta") throw new CampaignTemplateError("Connect a Meta WhatsApp account before preparing starter templates.", 409);
  const starters = campaignStarters(hotel);
  const { inventory } = await loadLinkedCampaignTemplates(organizationId, false, null, AbortSignal.timeout(20000));
  const { data: existing, error } = await admin.from("whatsapp_template_configs")
    .select("purpose,template_name,language_code,status,variable_keys").eq("organization_id", organizationId)
    .in("purpose", starters.map(item => item.purpose));
  if (error) throw new CampaignTemplateError("Unable to check existing campaign mappings.", 503);
  const results: Array<{ name: string; purpose: string; status: string }> = [];
  const result = (starter: typeof starters[number], status: string) => results.push({ name: starter.name, purpose: starter.purpose, status });
  for (const starter of starters) {
    const mapped = (existing || []).filter(item => item.purpose === starter.purpose);
    const provider = inventory.filter(item => item.name === starter.name && item.language === starter.language);
    if (mapped.length) {
      const row = mapped[0];
      const same = mapped.length === 1 && row.template_name === starter.name && row.language_code === starter.language &&
        JSON.stringify(row.variable_keys) === JSON.stringify(starter.variable_keys);
      result(starter, same && row.status === "active" && provider.length === 1 && provider[0].status === "APPROVED" && starterMatches(starter, provider[0]) ? "ready" : "existing_mapping_preserved");
      continue;
    }
    if (provider.length > 1 || (provider.length === 1 && !starterMatches(starter, provider[0]))) { result(starter, "contract_mismatch"); continue; }
    if (provider.length === 1) {
      const item = provider[0];
      if (item.status !== "APPROVED") { result(starter, item.status.toLowerCase()); continue; }
      const { error: insertError } = await admin.from("whatsapp_template_configs").insert({
        organization_id: organizationId, purpose: starter.purpose, template_name: starter.name, language_code: starter.language,
        variable_keys: [...starter.variable_keys], status: "active",
        metadata: { provider_status: "approved", approved_variable_order: [...starter.variable_keys], meta_template_id: item.id, starter_version: CAMPAIGN_STARTER_VERSION },
      });
      result(starter, insertError ? insertError.code === "23505" ? "mapping_conflict_refresh" : "mapping_failed" : "ready");
      continue;
    }
    if (!submitMissing) { result(starter, "not_submitted"); continue; }
    // The request body is built exclusively from the saved starter library.
    try {
      const response = await fetch(`https://graph.facebook.com/${credentials.graphVersion}/${credentials.wabaId}/message_templates`, {
        method: "POST", headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(starterMetaPayload(starter)), cache: "no-store", signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => ({})) as {id?: string; status?: string};
      result(starter, response.ok && payload.id ? "submitted_for_review" : response.ok ? "submission_unknown_refresh" : "provider_rejected_refresh");
    } catch {
      result(starter, "submission_unknown_refresh");
    }
  }
  return results;
}
