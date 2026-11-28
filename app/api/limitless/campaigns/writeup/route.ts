import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-followup-contract";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { loadLinkedCampaignTemplates, CampaignTemplateError } from "@/lib/portal-campaign-templates";
import { createCampaignWriteup, parseWriteupInput, CampaignWriteupError, type WriteupContract } from "@/lib/campaign-ai-writeup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } });
// Saved display wording mirrors the existing Limitless relationship preview. It is draft-only, never evidence of current Meta approval.
const relationshipDraftBody = "Hello {{1}},\n\n{{2}}\n\n{{3}}\n\nAt Limitless Realty, we appreciate the trust you place in us. We remain committed to helping you make confident property and investment decisions.\n\nWarm regards,\nLimitless Realty 🏡";
const contracts: Record<string, { purpose: string; name: string; keys: string[] }> = {
  estate_brief_update: { purpose: "estate_brief_update", name: "estate_brief_update", keys: ["customer_name", "property_name", "property_location", "property_price", "selling_point"] },
  limitless_realty_relationship_campaign: { purpose: "limitless_realty_relationship_campaign", name: "limitless_realty_relationship_campaign", keys: ["customer_name", "greeting", "call_to_action"] },
  limitless_realty_reminder: { purpose: "follow_up_outside_24h", name: "limitless_realty_reminder", keys: ["customer_name", "followup_context", "property_details", "next_step"] },
};

export async function POST(request: Request) {
  if (!(await getAdminSession())) return json({ error: "Unauthorized" }, 401);
  const scope = await resolveAdminOrganizationScope();
  if (scope.organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID || scope.slug !== "limitless-realty" || scope.status !== "active") return json({ error: "Switch to the active Limitless Realty workspace." }, 403);
  try {
    const body = await request.json().catch(() => null);
    const input = parseWriteupInput(body);
    const spec = contracts[body.campaignType];
    if (!spec && body.campaignType !== "direct_message") return json({ error: "This campaign route is unavailable." }, 409);
    await assertFluxFeatureAccess(scope.organizationId, "follow_ups");
    let contract: WriteupContract = { name: "direct_message", language: "en", body: "{{1}}", keys: ["message"] };
    let draftOnly = false;
    if (spec) {
      try {
        const { templates } = await loadLinkedCampaignTemplates(scope.organizationId, true, [spec.purpose]);
        const matching = templates.filter(item => item.name === spec.name && item.purpose === spec.purpose && JSON.stringify(item.variable_keys) === JSON.stringify(spec.keys));
        const template = matching.length === 1 ? matching[0] : undefined;
        if (!template) return json({ error: "The linked, approved template contract is unavailable or has changed." }, 409);
        contract = { name: template.name, language: template.language, body: template.body, keys: spec.keys };
      } catch (reason) {
        // Drafting can use the stored relationship contract when inventory is temporarily
        // unavailable. A live inventory result that rejects the contract never falls back.
        if (!(reason instanceof CampaignTemplateError) || reason.status < 500 || spec.name !== "limitless_realty_relationship_campaign") throw reason;
        const { data, error } = await createAdminClient().from("whatsapp_template_configs")
          .select("template_name,language_code,variable_keys,metadata").eq("organization_id",scope.organizationId)
          .eq("purpose",spec.purpose).eq("status","active").eq("template_name",spec.name).limit(2);
        const row = data?.length === 1 ? data[0] : undefined;
        if (error || !row || row.metadata?.provider_status !== "approved" || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(row.language_code) || JSON.stringify(row.variable_keys) !== JSON.stringify(spec.keys)) throw reason;
        contract = { name: spec.name, language: row.language_code, body: relationshipDraftBody, keys: spec.keys };
        draftOnly = true;
      }
    }
    const facts: Record<string, string> = {};
    if (body.propertyId) {
      if (typeof body.propertyId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.propertyId)) return json({ error: "Choose a valid property." }, 400);
      const property = await createAdminClient().from("properties").select("title,location_area,location_city,price").eq("organization_id", scope.organizationId).eq("id", body.propertyId).maybeSingle();
      if (property.error || !property.data) return json({ error: "The selected property is unavailable in this workspace." }, 404);
      facts.property_name = String(property.data.title || "");
      facts.property_location = [property.data.location_area, property.data.location_city].filter(Boolean).join(", ");
      facts.property_price = String(property.data.price || "");
    }
    if (body.campaignType === "estate_brief_update" && (!facts.property_name || !facts.property_location || !facts.property_price)) return json({ error: "Choose a property with a name, location and price first." }, 409);
    const draft = await createCampaignWriteup(scope.organizationId, contract, input, facts, request.headers.get("x-flux-operation-id") || crypto.randomUUID());
    return json({ ...draft, ...(draftOnly ? { warning: "Draft uses the saved relationship template. Live Meta approval could not be checked; sending still requires verification." } : {}) });
  } catch (error) {
    if (error instanceof CampaignWriteupError || error instanceof CampaignTemplateError) return json({ error: error.message }, error.status);
    return json({ error: "AI writing is unavailable. Check your plan and AI credits, or continue editing manually." }, 503);
  }
}
