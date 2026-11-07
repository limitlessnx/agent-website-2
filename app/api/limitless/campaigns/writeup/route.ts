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
    if (spec) {
      const { templates } = await loadLinkedCampaignTemplates(scope.organizationId, true, [spec.purpose]);
      const template = templates.find(item => item.name === spec.name && item.purpose === spec.purpose && item.language === "en_US");
      if (!template || JSON.stringify(template.variable_keys) !== JSON.stringify(spec.keys)) return json({ error: "The linked, approved template contract is unavailable or has changed." }, 409);
      contract = { name: template.name, language: template.language, body: template.body, keys: spec.keys };
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
    return json(await createCampaignWriteup(scope.organizationId, contract, input, facts));
  } catch (error) {
    if (error instanceof CampaignWriteupError || error instanceof CampaignTemplateError) return json({ error: error.message }, error.status);
    return json({ error: "AI writing is unavailable. Check your plan and AI credits, or continue editing manually." }, 503);
  }
}
