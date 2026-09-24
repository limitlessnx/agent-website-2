import { createAdminClient } from "@/lib/supabase/admin";

type TemplateConfig = { template_name: string; language_code: string; variable_keys?: string[] };
type SendInput = {
  organizationId: string;
  to: string;
  text?: string;
  lastCustomerMessageAt?: string | null;
  deliveryMode?: "auto" | "direct" | "template";
  forceTemplate?: boolean;
  templatePurpose?: string;
  variables?: Record<string, string | number | null | undefined>;
  propertyImageUrls?: string[];
  propertyVideoUrls?: string[];
};
type MetaResponse = { messages?: Array<{ id?: string }>; error?: { code?: number; message?: string; error_data?: { details?: string } } };
type WhatsAppCredentials = { phoneNumberId: string; accessToken: string; graphVersion: string; source: "tenant_vault" | "legacy_env" };

function supabaseConfig() {
  const url = (process.env.LIMITLESS_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  return { url, key };
}
async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error("Supabase delivery storage is not configured.");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase delivery request failed: ${response.status} ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
const normalizePhone = (value: string) => value.replace(/[^0-9]/g, "");
function outsideCustomerWindow(lastCustomerMessageAt?: string | null) {
  if (!lastCustomerMessageAt) return true;
  const timestamp = new Date(lastCustomerMessageAt).getTime();
  return !Number.isFinite(timestamp) || Date.now() - timestamp >= 24 * 60 * 60 * 1000;
}
async function resolveWhatsAppCredentials(organizationId: string): Promise<WhatsAppCredentials> {
  const admin = createAdminClient();
  const providers = ["whatsapp", "meta_whatsapp"];
  for (const provider of providers) {
    const { data: integration } = await admin
      .from("organization_integrations")
      .select("id,status,configuration")
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .in("status", ["configured", "connected", "degraded"])
      .limit(1)
      .maybeSingle();
    if (!integration) continue;
    const { data: credentials, error } = await admin.rpc("get_organization_integration_credentials", {
      p_organization_id: organizationId,
      p_provider: provider,
    });
    if (!error && credentials && typeof credentials === "object") {
      const raw = credentials as Record<string, unknown>;
      const config = (integration.configuration || {}) as Record<string, unknown>;
      const phoneNumberId = String(raw.phone_number_id || raw.phoneNumberId || config.phone_number_id || "");
      const accessToken = String(raw.access_token || raw.accessToken || "");
      const graphVersion = String(raw.graph_version || config.graph_version || process.env.WHATSAPP_GRAPH_VERSION || "v23.0");
      if (phoneNumberId && accessToken) return { phoneNumberId, accessToken, graphVersion, source: "tenant_vault" };
    }
  }

  const { data: org } = await admin.from("organizations").select("slug").eq("id", organizationId).maybeSingle();
  if (org?.slug === "limitless-realty") {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "";
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
    if (phoneNumberId && accessToken) return { phoneNumberId, accessToken, graphVersion, source: "legacy_env" };
  }

  throw new Error("WhatsApp Cloud API credentials are not configured for this organization.");
}
async function getTemplateConfig(organizationId: string, purpose: string): Promise<TemplateConfig | null> {
  const rows = await supabaseRequest<Array<TemplateConfig & { status: string }>>(`whatsapp_template_configs?organization_id=eq.${encodeURIComponent(organizationId)}&purpose=eq.${encodeURIComponent(purpose)}&status=eq.active&select=template_name,language_code,variable_keys,status&limit=1`);
  return rows[0] || null;
}
async function recordAttempt(payload: Record<string, unknown>) {
  return supabaseRequest<Array<{ id: string }>>("whatsapp_delivery_attempts", { method: "POST", body: JSON.stringify(payload) }).catch(() => []);
}
function isDirectPublicImageUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value) && !/drive\.google\.com/i.test(value) && /\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$/i.test(value);
}
function isDirectPublicVideoUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value) && !/drive\.google\.com|youtube\.com|youtu\.be/i.test(value) && /\.(?:mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(value);
}
function publicStorageUrl(bucket: unknown, path: unknown): string | null {
  const { url } = supabaseConfig();
  if (!url || typeof bucket !== "string" || typeof path !== "string" || !bucket || !path) return null;
  return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${String(path).split("/").map(encodeURIComponent).join("/")}`;
}
async function resolvePropertyMediaFromText(organizationId: string, text: string) {
  if (!text?.trim()) return { videos: [] as string[], images: [] as string[] };
  try {
    const rows = await supabaseRequest<Array<{ id?: string; title?: string; cover_image_url?: string | null; image_urls?: unknown }>>(`properties?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,title,cover_image_url,image_urls&limit=500`);
    const lower = text.toLowerCase();
    for (const row of rows) {
      const title = String(row.title || "").trim();
      if (title.length < 5 || !lower.includes(title.toLowerCase()) || !row.id) continue;
      const assets = await supabaseRequest<Array<{ storage_bucket?: string | null; storage_path?: string | null; mime_type?: string | null }>>(`media_assets?property_id=eq.${encodeURIComponent(String(row.id))}&select=storage_bucket,storage_path,mime_type&limit=20`);
      const videos = assets.filter((a) => /video\//i.test(String(a.mime_type || ""))).map((a) => publicStorageUrl(a.storage_bucket, a.storage_path)).filter((u): u is string => Boolean(u) && isDirectPublicVideoUrl(u)).slice(0, 3);
      if (videos.length) return { videos, images: [] };
      const candidates: unknown[] = [row.cover_image_url, ...(Array.isArray(row.image_urls) ? row.image_urls : [])];
      return { videos: [], images: candidates.filter(isDirectPublicImageUrl).slice(0, 3) };
    }
  } catch {}
  return { videos: [] as string[], images: [] as string[] };
}
async function sendMedia(args: { organizationId: string; to: string; type: "image" | "video"; url: string; credentials: WhatsAppCredentials }) {
  const { organizationId, to, type, url, credentials } = args;
  const payload = { messaging_product: "whatsapp", recipient_type: "individual", to, type, [type]: { link: url } };
  const response = await fetch(`https://graph.facebook.com/${credentials.graphVersion}/${encodeURIComponent(credentials.phoneNumberId)}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as MetaResponse;
  const providerMessageId = result.messages?.[0]?.id || null;
  await recordAttempt({ organization_id: organizationId, recipient: to, message_type: type, template_name: null, provider_message_id: providerMessageId, status: response.ok ? "accepted" : "failed", error_code: result.error?.code ? String(result.error.code) : null, error_message: result.error?.error_data?.details || result.error?.message || null, request_payload: payload, response_payload: result });
  if (!response.ok) throw new Error(result.error?.error_data?.details || result.error?.message || `WhatsApp ${type} send failed (${response.status}).`);
  return { ok: true, providerMessageId };
}

export async function sendWhatsAppMessage(input: SendInput) {
  const credentials = await resolveWhatsAppCredentials(input.organizationId);
  const to = normalizePhone(input.to);
  if (!to) throw new Error("A valid WhatsApp recipient is required.");
  const outsideWindow = outsideCustomerWindow(input.lastCustomerMessageAt);
  const requestedMode = input.deliveryMode || "auto";
  const useTemplate = Boolean(input.forceTemplate) || requestedMode === "template" || (requestedMode === "auto" && outsideWindow);
  if (requestedMode === "direct" && outsideWindow) throw new Error("Direct WhatsApp messages are only available while the customer's 24-hour service window is open.");

  let requestPayload: Record<string, unknown>;
  let templateName: string | null = null;
  if (useTemplate) {
    const config = await getTemplateConfig(input.organizationId, input.templatePurpose || "follow_up_outside_24h");
    if (!config) throw new Error(`No active approved WhatsApp template is configured for ${input.organizationId}.`);
    templateName = config.template_name;
    const parameters = (Array.isArray(config.variable_keys) ? config.variable_keys : []).map((key) => ({ type: "text", text: String(input.variables?.[key] ?? "") }));
    requestPayload = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template", template: { name: config.template_name, language: { code: config.language_code }, ...(parameters.length ? { components: [{ type: "body", parameters }] } : {}) } };
  } else {
    if (!input.text?.trim()) throw new Error("Message text is required while the 24-hour service window is open.");
    requestPayload = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: input.text } };
  }

  if (!useTemplate) {
    const suppliedVideos = (input.propertyVideoUrls || []).filter(isDirectPublicVideoUrl).slice(0, 3);
    const suppliedImages = (input.propertyImageUrls || []).filter(isDirectPublicImageUrl).slice(0, 3);
    const media = suppliedVideos.length || suppliedImages.length ? { videos: suppliedVideos, images: suppliedImages } : await resolvePropertyMediaFromText(input.organizationId, input.text || "");
    if (media.videos.length) for (const url of media.videos) await sendMedia({ organizationId: input.organizationId, to, type: "video", url, credentials });
    else for (const url of media.images) await sendMedia({ organizationId: input.organizationId, to, type: "image", url, credentials });
  }

  const response = await fetch(`https://graph.facebook.com/${credentials.graphVersion}/${encodeURIComponent(credentials.phoneNumberId)}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(requestPayload), cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as MetaResponse;
  const providerMessageId = result.messages?.[0]?.id || null;
  const errorCode = result.error?.code ? String(result.error.code) : null;
  const errorMessage = result.error?.error_data?.details || result.error?.message || null;
  await recordAttempt({ organization_id: input.organizationId, recipient: to, message_type: useTemplate ? "template" : "text", template_name: templateName, provider_message_id: providerMessageId, status: response.ok ? "accepted" : errorCode === "131026" ? "blocked" : "failed", error_code: errorCode, error_message: errorMessage, request_payload: requestPayload, response_payload: result });
  if (!response.ok) {
    const error = new Error(errorMessage || `WhatsApp Cloud API returned ${response.status}.`);
    Object.assign(error, { status: response.status, code: errorCode, response: result });
    throw error;
  }
  return { ok: true, messageType: useTemplate ? "template" : "text", templateName, providerMessageId, credentialSource: credentials.source, response: result };
}
