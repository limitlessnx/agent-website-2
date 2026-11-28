import { createAdminClient } from "@/lib/supabase/admin";
import { campaignStarters } from "@/lib/campaign-starter-templates";
import { validPromotionBody } from "@/lib/whatsapp-promotion-message";

export type SavedCampaignDraft = { name: string; language: string; purpose: string; keys: string[]; body: string; wordingVerified: boolean };
/** Draft-only contracts. Never imported by dispatch, review, or template approval code.
 * If a custom template's actual wording is unavailable, use an explicitly labeled
 * field guide, not an invented copy of its provider body. */
export async function loadSavedCampaignDrafts(organizationId: string, hotel: boolean): Promise<SavedCampaignDraft[]> {
  const purposes = hotel ? ["hotel_campaign"] : ["campaign", "campaign_promotion"];
  const { data, error } = await createAdminClient().from("whatsapp_template_configs")
    .select("template_name,language_code,purpose,variable_keys").eq("organization_id", organizationId)
    .eq("status", "active").in("purpose", purposes);
  if (error) throw new Error("Unable to load saved template mappings.");
  const starters = campaignStarters(hotel);
  const rows = data || [];
  const result: SavedCampaignDraft[] = [];
  for (const row of rows) {
    const keys: unknown = row.variable_keys;
    if (!Array.isArray(keys) || !keys.length || keys.length > 20 || keys.some(key => typeof key !== "string" || !/^[a-z][a-z0-9_]{0,79}$/.test(key)) || new Set(keys).size !== keys.length || keys.every(key => key === "customer_name" || key === "business_name")) continue;
    if (typeof row.template_name !== "string" || !/^[a-z0-9_]{1,512}$/.test(row.template_name) || typeof row.language_code !== "string" || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(row.language_code)) continue;
    if (rows.filter(other => other.template_name === row.template_name && other.language_code === row.language_code).length !== 1 || !purposes.includes(row.purpose)) continue;
    const starter = starters.find(item => item.name === row.template_name && item.language === row.language_code && item.purpose === row.purpose && JSON.stringify(item.variable_keys) === JSON.stringify(keys));
    const body = starter?.body || keys.map((key,index) => `${key.replaceAll("_"," ")}: {{${index+1}}}`).join("\n");
    if (!validPromotionBody(body,keys)) continue;
    result.push({name:row.template_name,language:row.language_code,purpose:row.purpose,keys,body,wordingVerified:Boolean(starter)});
  }
  // A new tenant can prepare starter copy even before connecting Meta.
  // Do not replace an existing mapped purpose, including an invalid/ambiguous mapping.
  for (const starter of starters) {
    if (!rows.some(row => row.purpose === starter.purpose)) result.push({name:starter.name,language:starter.language,purpose:starter.purpose,keys:[...starter.variable_keys],body:starter.body,wordingVerified:true});
  }
  return result;
}
