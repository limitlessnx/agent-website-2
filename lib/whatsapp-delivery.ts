type TemplateConfig = {
  template_name: string;
  language_code: string;
  variable_keys?: string[];
};

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
};

type MetaResponse = {
  messages?: Array<{ id?: string }>;
  error?: { code?: number; message?: string; error_data?: { details?: string } };
};

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

function normalizePhone(value: string) { return value.replace(/[^0-9]/g, ""); }
function outsideCustomerWindow(lastCustomerMessageAt?: string | null) {
  if (!lastCustomerMessageAt) return true;
  const timestamp = new Date(lastCustomerMessageAt).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp >= 24 * 60 * 60 * 1000;
}

async function getTemplateConfig(organizationId: string, purpose: string): Promise<TemplateConfig | null> {
  const rows = await supabaseRequest<Array<TemplateConfig & { status: string }>>(`whatsapp_template_configs?organization_id=eq.${encodeURIComponent(organizationId)}&purpose=eq.${encodeURIComponent(purpose)}&status=eq.active&select=template_name,language_code,variable_keys,status&limit=1`);
  return rows[0] || null;
}

async function recordAttempt(payload: Record<string, unknown>) {
  return supabaseRequest<Array<{ id: string }>>("whatsapp_delivery_attempts", { method: "POST", body: JSON.stringify(payload) }).catch(() => []);
}

function isDirectPublicImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return false;
  if (/google\.(com|[a-z.]+)\/|images\.google\.|googleusercontent\.com\/url\?/i.test(value)) return false;
  if (/drive\.google\.com/i.test(value)) return false;
  return /\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$/i.test(value);
}

async function resolvePropertyImagesFromText(text: string): Promise<string[]> {
  if (!text?.trim()) return [];
  try {
    const rows = await supabaseRequest<Array<{ title?: string; cover_image_url?: string | null; image_urls?: unknown; drive_photos_link?: string | null }>>("properties?select=title,cover_image_url,image_urls,drive_photos_link&limit=500");
    const lower = text.toLowerCase();
    const images: string[] = [];
    for (const row of rows) {
      const title = String(row.title || "").trim();
      if (title.length < 5 || !lower.includes(title.toLowerCase())) continue;
      const candidates: unknown[] = [row.cover_image_url];
      if (Array.isArray(row.image_urls)) candidates.push(...row.image_urls);
      else if (typeof row.image_urls === "string") {
        try { const parsed = JSON.parse(row.image_urls); if (Array.isArray(parsed)) candidates.push(...parsed); } catch {}
      }
      candidates.push(row.drive_photos_link);
      for (const candidate of candidates) {
        if (isDirectPublicImageUrl(candidate) && !images.includes(candidate)) images.push(candidate);
      }
      if (images.length >= 3) break;
    }
    return images.slice(0, 3);
  } catch {
    return [];
  }
}

async function sendWhatsAppImage(to: string, imageUrl: string, phoneNumberId: string, accessToken: string, graphVersion: string) {
  const payload = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "image", image: { link: imageUrl } };
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
  const result = await response.json().catch(() => ({})) as MetaResponse;
  const providerMessageId = result.messages?.[0]?.id || null;
  await recordAttempt({ organization_id: "limitless-realty", recipient: to, message_type: "image", template_name: null, provider_message_id: providerMessageId, status: response.ok ? "accepted" : "failed", error_code: result.error?.code ? String(result.error.code) : null, error_message: result.error?.error_data?.details || result.error?.message || null, request_payload: payload, response_payload: result });
  if (!response.ok) return { ok: false, providerMessageId, error: result.error?.error_data?.details || result.error?.message || `WhatsApp image send failed (${response.status}).` };
  return { ok: true, providerMessageId };
}

export async function sendWhatsAppMessage(input: SendInput) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "";
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  if (!phoneNumberId || !accessToken) throw new Error("WhatsApp Cloud API credentials are not configured.");

  const to = normalizePhone(input.to);
  if (!to) throw new Error("A valid WhatsApp recipient is required.");

  const isOutsideWindow = outsideCustomerWindow(input.lastCustomerMessageAt);
  const requestedMode = input.deliveryMode || "auto";
  const useTemplate = Boolean(input.forceTemplate) || requestedMode === "template" || (requestedMode === "auto" && isOutsideWindow);
  if (requestedMode === "direct" && isOutsideWindow) throw new Error("Direct WhatsApp messages are only available while the customer's 24-hour service window is open. Choose the appropriate approved campaign template instead.");

  let requestPayload: Record<string, unknown>;
  let templateName: string | null = null;

  if (useTemplate) {
    const purpose = input.templatePurpose || "follow_up_outside_24h";
    const config = await getTemplateConfig(input.organizationId, purpose);
    if (!config) throw new Error(`No active approved WhatsApp template is configured for ${input.organizationId} and purpose ${purpose}.`);
    templateName = config.template_name;
    const variableKeys = Array.isArray(config.variable_keys) ? config.variable_keys : [];
    const parameters = variableKeys.map((key) => ({ type: "text", text: String(input.variables?.[key] ?? "") }));
    requestPayload = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template", template: { name: config.template_name, language: { code: config.language_code }, ...(parameters.length ? { components: [{ type: "body", parameters }] } : {}) } };
  } else {
    if (!input.text?.trim()) throw new Error("Message text is required while the 24-hour service window is open.");
    requestPayload = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: input.text } };
  }

  if (!useTemplate && input.organizationId === "limitless-realty") {
    const imageUrls = (input.propertyImageUrls || []).filter(isDirectPublicImageUrl).slice(0, 3);
    const resolvedImages = imageUrls.length ? imageUrls : await resolvePropertyImagesFromText(input.text || "");
    for (const imageUrl of resolvedImages) await sendWhatsAppImage(to, imageUrl, phoneNumberId, accessToken, graphVersion);
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(requestPayload), cache: "no-store" });
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

  return { ok: true, messageType: useTemplate ? "template" : "text", templateName, providerMessageId, response: result };
}
