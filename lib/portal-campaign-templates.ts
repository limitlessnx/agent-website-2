import { createAdminClient } from "@/lib/supabase/admin";
import { validPromotionBody, type PromotionTemplate } from "@/lib/whatsapp-promotion-message";

export class CampaignTemplateError extends Error { constructor(message: string, public status = 503) { super(message); } }
type MetaTemplate = { name?: string; status?: string; language?: string; category?: string; components?: Array<{ type?: string; format?: string; text?: string; buttons?: Array<{ type?: string; text?: string; url?: string }> }> };
type MetaResponse = { data?: MetaTemplate[]; paging?: { next?: string }; error?: { message?: string; code?: number; error_subcode?: number; type?: string; fbtrace_id?: string } };

function placeholders(template: MetaTemplate) {
  const found = new Set<number>();
  for (const component of template.components || []) for (const match of (component.text || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) found.add(Number(match[1]));
  return [...found].filter(Number.isInteger).sort((a, b) => a - b);
}

export async function loadLinkedCampaignTemplates(organizationId: string, linkedOnly = true, purposes = ["campaign", "customer_follow_up", "campaign_promotion", "hotel_campaign"]) {
  const admin = createAdminClient();
  const { data: linked, error: linkedError } = await admin.from("whatsapp_template_configs")
    .select("template_name,language_code,purpose,variable_keys").eq("organization_id", organizationId).eq("status", "active")
    .in("purpose", purposes);
  if (linkedError) throw new CampaignTemplateError("Unable to read linked campaign templates.", 503);
  const promotionOnly = purposes.length === 1 && purposes[0] === "campaign_promotion";
  if (promotionOnly && linked?.length !== 1) {
    throw new CampaignTemplateError("Ask your administrator to assign one active WhatsApp promotion template.", 409);
  }
  const { data: integration, error: integrationError } = await admin.from("organization_integrations").select("configuration,status").eq("organization_id", organizationId).eq("provider", "whatsapp").in("status", ["configured", "connected", "degraded"]).maybeSingle();
  if (integrationError) throw new CampaignTemplateError("Unable to read WhatsApp configuration.", 500);
  if (!integration) throw new CampaignTemplateError("Connect WhatsApp before loading Meta templates.", 409);
  const { data: rawCredentials, error: credentialsError } = await admin.rpc("get_organization_integration_credentials", { p_organization_id: organizationId, p_provider: "whatsapp" });
  if (credentialsError) throw new CampaignTemplateError("WhatsApp credentials are not available.", 409);
  const credentials = rawCredentials && typeof rawCredentials === "object" ? rawCredentials as Record<string, unknown> : {};
  const configuration = integration.configuration && typeof integration.configuration === "object" ? integration.configuration as Record<string, unknown> : {};
  const wabaId = String(credentials.waba_id || credentials.wabaId || configuration.waba_id || "").trim();
  const accessToken = String(credentials.access_token || credentials.accessToken || "").trim();
  if (promotionOnly && (credentials.provider_family || configuration.provider_family || "meta") !== "meta") {
    throw new CampaignTemplateError("The assigned promotion requires a connected Meta WhatsApp account.", 409);
  }
  const graphVersion = String(credentials.graph_version || configuration.graph_version || process.env.WHATSAPP_GRAPH_VERSION || "v26.0").trim();
  if (!/^\d+$/.test(wabaId) || !accessToken || !/^v\d+\.\d+$/.test(graphVersion)) throw new CampaignTemplateError("Meta WhatsApp Business credentials are incomplete.", 409);
  let nextUrl: URL | null = new URL(`https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`);
  nextUrl.searchParams.set("fields", "name,status,language,category,components"); nextUrl.searchParams.set("limit", "100");
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
  return { ok: true, templates: rows.flatMap((template) => {
    const config = (linked || []).find((item) => item.template_name === template.name && item.language_code === template.language);
    if (linkedOnly && !config || template.status !== "APPROVED") return [];
    return [{ name: String(template.name || ""), status: "APPROVED", language: String(template.language || ""), category: String(template.category || ""), purpose: String(config?.purpose || ""), variable_keys: (config?.variable_keys || []) as string[], body: (template.components || []).filter(component => component.type === "BODY").map(component => component.text || "").join("\n"), placeholder_count: placeholders(template).length, placeholder_indexes: placeholders(template), components: template.components || [] }];
  }).sort((a, b) => a.name.localeCompare(b.name)) };
}

export async function loadAssignedPromotion(organizationId: string): Promise<PromotionTemplate> {
  const { templates } = await loadLinkedCampaignTemplates(organizationId, true, ["campaign_promotion"]);
  const [template] = templates;
  if (templates.length !== 1 || template.category !== "MARKETING") {
    throw new CampaignTemplateError("The assigned promotion is unavailable or is no longer approved for marketing by Meta.", 409);
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
  return { name, language, body, variable_keys, header: header?.text || "", footer: footer?.text || "", buttonLabels: buttons.map(button => button.text!) };
}
