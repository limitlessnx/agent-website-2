import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTenantWhatsAppCredentials, WhatsAppCredentialError } from "@/lib/whatsapp-credentials";
import { validPromotionBody, type PromotionTemplate } from "@/lib/whatsapp-promotion-message";

export class CampaignTemplateError extends Error { constructor(message: string, public status = 503) { super(message); } }
type MetaTemplate = { id?: string; name?: string; status?: string; language?: string; category?: string; components?: Array<{ type?: string; format?: string; text?: string; buttons?: Array<{ type?: string; text?: string; url?: string }> }> };
type MetaResponse = { data?: MetaTemplate[]; paging?: { next?: string }; error?: { message?: string; code?: number; error_subcode?: number; type?: string; fbtrace_id?: string } };

function placeholders(template: MetaTemplate) {
  const found = new Set<number>();
  for (const component of template.components || []) for (const match of (component.text || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) found.add(Number(match[1]));
  return [...found].filter(Number.isInteger).sort((a, b) => a - b);
}

/** Suggestions are advisory only. Existing explicit mappings always take precedence. */
export function suggestTemplatePurpose(name: string, category: string): string | null {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (category === "AUTHENTICATION") return "authentication";
  if (category === "MARKETING") {
    if (/(^|_)(follow_?up|follow_ip|reminder|handoff|handover|hand_over|appointment|installment|payment|booking_confirmation|booking_cancellation)(_|$)/.test(normalized)) return null;
    if (/(^|_)(estate_brief_update)(_|$)/.test(normalized)) return "estate_brief_update";
    if (/(^|_)(market_update|realty_update)(_|$)/.test(normalized)) return "limitless_realty_update";
    if (/(^|_)(promotion|promo|offer|offers|discount)(_|$)/.test(normalized)) return "campaign_promotion";
    if (/(^|_)(wishes|birthday|greeting|relationship|campaign)(_|$)/.test(normalized)) return "campaign";
    return null;
  }
  if (category !== "UTILITY") return null;
  const candidates: string[] = [];
  if (/(^|_)(installment|instalment|payment_reminder)(_|$)/.test(normalized)) candidates.push("installment_payment_reminder");
  if (/(^|_)(appointment_reminder)(_|$)/.test(normalized)) candidates.push("appointment_reminder");
  if (/(^|_)(booking_confirmation|booking_confirmed)(_|$)/.test(normalized)) candidates.push("booking_confirmation");
  if (/(^|_)(booking_cancellation|booking_cancelled)(_|$)/.test(normalized)) candidates.push("booking_cancellation");
  if (/(^|_)(follow_?up|follow_ip)(_|$)/.test(normalized)) candidates.push("customer_follow_up");
  if (/(^|_)(handoff|handover|hand_over)(_|$)/.test(normalized)) candidates.push("human_handoff_staff");
  return candidates.length === 1 ? candidates[0] : null;
}

export async function loadLinkedCampaignTemplates(organizationId: string, linkedOnly = true, purposes: string[] | null = ["campaign", "customer_follow_up", "campaign_promotion", "hotel_campaign"]) {
  const admin = createAdminClient();
  const query = admin.from("whatsapp_template_configs")
    .select("template_name,language_code,purpose,variable_keys").eq("organization_id", organizationId).eq("status", "active");
  const { data: linked, error: linkedError } = await (purposes ? query.in("purpose", purposes) : query);
  if (linkedError) throw new CampaignTemplateError("Unable to read linked campaign templates.", 503);
  const promotionOnly = purposes?.length === 1 && purposes[0] === "campaign_promotion";
  if (promotionOnly && linked?.length !== 1) {
    throw new CampaignTemplateError("Ask your administrator to assign one active WhatsApp promotion template.", 409);
  }
  const credentials = await resolveTenantWhatsAppCredentials(admin, organizationId, { inventory: true }).catch(error => {
    if (error instanceof WhatsAppCredentialError) throw new CampaignTemplateError(error.message, error.status);
    throw error;
  });
  if (credentials.providerFamily !== "meta") throw new CampaignTemplateError("Template discovery requires a connected Meta WhatsApp account.", 409);
  const { wabaId, accessToken, graphVersion } = credentials;
  let nextUrl: URL | null = new URL(`https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`);
  nextUrl.searchParams.set("fields", "id,name,status,language,category,components"); nextUrl.searchParams.set("limit", "100");
  const rows: MetaTemplate[] = []; let pageCount = 0;
  while (nextUrl && pageCount < 10) {
    let response: Response;
    try {
      response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      console.error("[campaign-template-inventory] Meta request transport failure", {
        organizationId, page: pageCount + 1,
        errorType: error instanceof Error ? error.name : "unknown",
      });
      throw new CampaignTemplateError("Meta template inventory request failed to connect. Try again later.", 503);
    }
    const payload = await response.json().catch(() => ({})) as MetaResponse;
    if (!response.ok) {
      console.error("[campaign-template-inventory] Meta request rejected", {
        organizationId, page: pageCount + 1, httpStatus: response.status,
        metaCode: typeof payload.error?.code === "number" ? payload.error.code : null,
        metaSubcode: typeof payload.error?.error_subcode === "number" ? payload.error.error_subcode : null,
        metaType: typeof payload.error?.type === "string" ? payload.error.type : null,
        fbTraceId: typeof payload.error?.fbtrace_id === "string" ? payload.error.fbtrace_id : null,
      });
      const metaCode = typeof payload.error?.code === "number" ? payload.error.code : null;
      const safeReason = response.status === 401 || metaCode === 190
        ? "Meta authentication failed. Reconnect the WhatsApp business account."
        : response.status === 403 || metaCode === 10 || metaCode === 200
          ? "Meta denied template access. Verify WhatsApp Business permissions and WABA access."
          : response.status === 429
            ? "Meta is rate limiting template requests. Try again later."
            : response.status >= 500
              ? "Meta template service is temporarily unavailable. Try again later."
              : "Meta rejected the template inventory request. Verify the linked WhatsApp Business Account.";
      throw new CampaignTemplateError(safeReason, response.status === 429 ? 503 : 502);
    }
    if (!Array.isArray(payload.data)) {
      console.error("[campaign-template-inventory] Invalid Meta response", { organizationId, page: pageCount + 1, httpStatus: response.status });
      throw new CampaignTemplateError("Meta returned an incomplete template inventory. Try again later.", 502);
    }
    rows.push(...payload.data);
    const next = payload.paging?.next;
    if (!next) nextUrl = null;
    else { const candidate = new URL(next); if (candidate.protocol !== "https:" || candidate.hostname !== "graph.facebook.com" || !candidate.pathname.includes(`/${wabaId}/message_templates`)) throw new CampaignTemplateError("Meta returned an unsafe pagination URL.", 502); nextUrl = candidate; }
    pageCount += 1;
  }
  if (nextUrl) throw new CampaignTemplateError("The template inventory is incomplete. Try again later.", 503);
  const inventory = rows.filter(template => template.name && template.language).map(template => {
    const matches = (linked || []).filter(item => item.template_name === template.name && item.language_code === template.language);
    const config = matches.length === 1 ? matches[0] : undefined;
    return {
      id: String(template.id || ""), name: String(template.name), status: String(template.status || "UNKNOWN"),
      language: String(template.language), category: String(template.category || ""),
      purpose: String(config?.purpose || ""), variable_keys: (config?.variable_keys || []) as string[],
      mapping_status: matches.length === 1 ? "linked" : matches.length > 1 ? "ambiguous" : "unlinked",
      suggested_purpose: matches.length === 0 && template.status === "APPROVED" ? suggestTemplatePurpose(String(template.name), String(template.category || "")) : null,
      body: (template.components || []).filter(component => component.type === "BODY").map(component => component.text || "").join("\n"),
      placeholder_count: placeholders(template).length, placeholder_indexes: placeholders(template), components: template.components || [],
    };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));
  // Duplicate provider records must not be eligible for routing.
  const templates = inventory.filter(item => item.status === "APPROVED" && (!linkedOnly || item.mapping_status === "linked")
    && inventory.filter(other => other.name === item.name && other.language === item.language).length === 1);
  const missingMappings = (linked || []).filter(item => !inventory.some(template => template.name === item.template_name && template.language === item.language_code))
    .map(item => ({ name: item.template_name, language: item.language_code, purpose: item.purpose }));
  return { ok: true, templates, inventory, missingMappings };

}

type RegistryTemplate = Awaited<ReturnType<typeof loadLinkedCampaignTemplates>>["templates"][number];
export type RoutedPromotion = PromotionTemplate & { purpose: string };

function asMarketingPromotion(template: RegistryTemplate): RoutedPromotion {
  if (template.category !== "MARKETING" || !["campaign", "campaign_promotion"].includes(template.purpose)) {
    throw new CampaignTemplateError("The selected template is not approved for this marketing workflow.", 409);
  }
  const { name, language, body, variable_keys, components } = template;
  const header = components.find(component => component.type === "HEADER");
  const footer = components.find(component => component.type === "FOOTER");
  const buttons = components.find(component => component.type === "BUTTONS")?.buttons || [];
  const staticText = (value?: string) => !value?.includes("{{");
  if (!Array.isArray(variable_keys) || !validPromotionBody(body, variable_keys)
      || components.filter(component => component.type === "BODY").length !== 1
      || components.some(component => !["HEADER", "BODY", "FOOTER", "BUTTONS"].includes(component.type || ""))
      || (header && (header.format !== "TEXT" || !staticText(header.text)))
      || !staticText(footer?.text)
      || buttons.some(button => !["URL", "PHONE_NUMBER", "QUICK_REPLY"].includes(button.type || "")
        || !button.text || !staticText(button.text) || !staticText(button.url))) {
    throw new CampaignTemplateError("The assigned promotion has unsupported fields. Ask your administrator to check its WhatsApp template setup.", 409);
  }
  return { name, language, body, variable_keys, purpose: template.purpose, header: header?.text || "", footer: footer?.text || "", buttonLabels: buttons.map(button => button.text!) };
}

/** Return only safe, explicitly linked marketing templates for the reviewed contact workflow. */
export async function loadCampaignPromotions(organizationId: string) {
  const { templates, inventory } = await loadLinkedCampaignTemplates(organizationId, true, null);
  const promotions = templates.flatMap(template => {
    try { return [asMarketingPromotion(template)]; }
    catch (error) { if (error instanceof CampaignTemplateError) return []; throw error; }
  });
  return { promotions, inventory };
}

export async function loadAssignedPromotion(organizationId: string, selection?: { name: string; language: string }): Promise<RoutedPromotion> {
  if (selection) {
    const { promotions } = await loadCampaignPromotions(organizationId);
    const matches = promotions.filter(template => template.name === selection.name && template.language === selection.language);
    if (matches.length !== 1) throw new CampaignTemplateError("The selected marketing template is unavailable or not approved for this workflow.", 409);
    return matches[0];
  }
  const { templates } = await loadLinkedCampaignTemplates(organizationId, true, ["campaign_promotion"]);
  if (templates.length !== 1) throw new CampaignTemplateError("The assigned promotion is unavailable or is no longer approved for marketing by Meta.", 409);
  return asMarketingPromotion(templates[0]);
}
