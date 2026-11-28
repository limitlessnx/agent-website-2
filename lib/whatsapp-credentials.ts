import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
export type MetaWhatsAppCredentials = { providerFamily: "meta"; phoneNumberId: string; wabaId: string; accessToken: string; graphVersion: string; source: "tenant_vault" | "legacy_env" };
export type TwilioWhatsAppCredentials = { providerFamily: "twilio"; accountSid: string; authToken: string; from: string; senderSid: string | null; source: "tenant_vault" };
export type WhatsAppCredentials = MetaWhatsAppCredentials | TwilioWhatsAppCredentials;
export class WhatsAppCredentialError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
const text = (value: unknown) => String(value ?? "").trim();
const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const LIMITLESS_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";

/** Both inventory and delivery use the same tenant account. Never fall through
 * an incomplete primary integration to a different provider or global token. */
export async function resolveTenantWhatsAppCredentials(
  admin: Admin,
  organizationId: string,
  options: { allowLegacyDelivery?: boolean; inventory?: boolean } = {},
  env: Record<string, string | undefined> = process.env,
): Promise<WhatsAppCredentials> {
  if (!organizationId.trim()) throw new WhatsAppCredentialError("A WhatsApp organization is required.");
  for (const provider of ["whatsapp", "meta_whatsapp"]) {
    const { data: integration, error } = await admin.from("organization_integrations")
      .select("id,status,configuration").eq("organization_id", organizationId)
      .eq("provider", provider).in("status", ["configured", "connected", "degraded"]).maybeSingle();
    if (error) throw new WhatsAppCredentialError("Unable to read WhatsApp configuration.", 503);
    if (!integration) continue;
    const { data, error: vaultError } = await admin.rpc("get_organization_integration_credentials", {
      p_organization_id: organizationId, p_provider: provider,
    });
    if (vaultError || !data || typeof data !== "object") throw new WhatsAppCredentialError("WhatsApp credentials are not available.");
    const raw = record(data), config = record(integration.configuration);
    const family = text(raw.provider_family || config.provider_family || "meta");
    if (family === "twilio") {
      if (options.inventory) throw new WhatsAppCredentialError("Template discovery requires a connected Meta WhatsApp account.");
      const accountSid = text(raw.twilio_account_sid || config.twilio_subaccount_sid);
      const authToken = text(raw.twilio_auth_token);
      const from = text(raw.twilio_whatsapp_sender || config.sender_phone_e164);
      const senderSid = text(raw.twilio_sender_sid || config.twilio_sender_sid) || null;
      if (accountSid && authToken && from) return { providerFamily: "twilio", accountSid, authToken, from, senderSid, source: "tenant_vault" };
      throw new WhatsAppCredentialError("Twilio WhatsApp credentials are incomplete.");
    }
    if (family !== "meta") throw new WhatsAppCredentialError("Unsupported WhatsApp provider.");
    const phoneNumberId = text(raw.phone_number_id || raw.phoneNumberId || config.phone_number_id || config.phoneNumberId);
    const wabaId = text(raw.waba_id || raw.wabaId || config.waba_id || config.wabaId);
    const accessToken = text(raw.access_token || raw.accessToken);
    const graphVersion = text(raw.graph_version || config.graph_version || env.WHATSAPP_GRAPH_VERSION || "v23.0");
    if (!accessToken || !/^v\d+\.\d+$/.test(graphVersion) || (options.inventory ? !/^\d+$/.test(wabaId) : !phoneNumberId)) {
      throw new WhatsAppCredentialError("Meta WhatsApp Business credentials are incomplete.");
    }
    return { providerFamily: "meta", phoneNumberId, wabaId, accessToken, graphVersion, source: "tenant_vault" };
  }
  // Preserve the existing dedicated Limitless delivery fallback only if there
  // is no active integration. Inventory and other tenants never use it.
  if (options.allowLegacyDelivery && !options.inventory && organizationId === LIMITLESS_ID) {
    const phoneNumberId = text(env.WHATSAPP_PHONE_NUMBER_ID || env.META_WHATSAPP_PHONE_NUMBER_ID);
    const accessToken = text(env.WHATSAPP_ACCESS_TOKEN || env.META_WHATSAPP_ACCESS_TOKEN);
    const graphVersion = text(env.WHATSAPP_GRAPH_VERSION || "v23.0");
    if (phoneNumberId && accessToken && /^v\d+\.\d+$/.test(graphVersion)) {
      return { providerFamily: "meta", phoneNumberId, wabaId: "", accessToken, graphVersion, source: "legacy_env" };
    }
  }
  throw new WhatsAppCredentialError("Connect WhatsApp before loading templates or sending messages.");
}
