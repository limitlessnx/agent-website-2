import { createAdminClient } from "@/lib/supabase/admin";

type Json = Record<string, unknown>;

export type WhatsAppReadiness = {
  organizationId: string;
  configured: boolean;
  credentialSource: "tenant_vault" | "legacy_env" | "none";
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  accountStatus: string | null;
  webhookSecretConfigured: boolean;
  verifyTokenConfigured: boolean;
  triggerRuntimeConfigured: boolean;
  readyForCutover: boolean;
  checks: Array<{ key: string; ok: boolean; detail: string }>;
};

export async function getWhatsAppIntegration(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_integrations")
    .select("id,organization_id,provider,status,display_name,configuration,health,last_checked_at,last_connected_at")
    .eq("organization_id", organizationId)
    .in("provider", ["whatsapp", "meta_whatsapp"])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getWhatsAppCredentials(organizationId: string) {
  const admin = createAdminClient() as any;
  for (const provider of ["whatsapp", "meta_whatsapp"]) {
    const { data, error } = await admin.rpc("get_organization_integration_credentials", {
      p_organization_id: organizationId,
      p_provider: provider,
    });
    if (!error && data && typeof data === "object") return data as Json;
  }
  return null;
}

export async function saveWhatsAppCredentials(input: {
  organizationId: string;
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
  graphVersion?: string;
}) {
  const admin = createAdminClient() as any;
  const existing = await getWhatsAppIntegration(input.organizationId);
  const configuration = (existing?.configuration || {}) as Json;
  const graphVersion = input.graphVersion || String(configuration.graph_version || "v23.0");
  const { error } = await admin.rpc("store_organization_integration_credentials", {
    p_organization_id: input.organizationId,
    p_provider: "whatsapp",
    p_display_name: "WhatsApp",
    p_credentials: {
      phone_number_id: input.phoneNumberId,
      access_token: input.accessToken,
      waba_id: input.wabaId || null,
      graph_version: graphVersion,
    },
    p_configuration: {
      ...configuration,
      phone_number_id: input.phoneNumberId,
      waba_id: input.wabaId || null,
      graph_version: graphVersion,
      runtime_route: "trigger_dev",
      configured_at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}

async function verifyMetaPhoneNumber(credentials: Json) {
  const phoneNumberId = String(credentials.phone_number_id || credentials.phoneNumberId || "");
  const accessToken = String(credentials.access_token || credentials.accessToken || "");
  const graphVersion = String(credentials.graph_version || "v23.0");
  if (!phoneNumberId || !accessToken) throw new Error("WhatsApp phone number ID or access token is missing.");
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}`);
  url.searchParams.set("fields", "display_phone_number,verified_name,quality_rating,status");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as Json;
  if (!response.ok) {
    const error = body.error as Json | undefined;
    throw new Error(String(error?.message || `Meta returned ${response.status}`));
  }
  return body;
}

export async function checkWhatsAppReadiness(organizationId: string): Promise<WhatsAppReadiness> {
  const admin = createAdminClient();
  const integration = await getWhatsAppIntegration(organizationId);
  let credentials = await getWhatsAppCredentials(organizationId);
  let credentialSource: WhatsAppReadiness["credentialSource"] = credentials ? "tenant_vault" : "none";

  if (!credentials) {
    const { data: org } = await admin.from("organizations").select("slug").eq("id", organizationId).maybeSingle();
    if (org?.slug === "limitless-realty") {
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "";
      if (phoneNumberId && accessToken) {
        credentials = {
          phone_number_id: phoneNumberId,
          access_token: accessToken,
          graph_version: process.env.WHATSAPP_GRAPH_VERSION || "v23.0",
        };
        credentialSource = "legacy_env";
      }
    }
  }

  const appSecretConfigured = Boolean(process.env.WHATSAPP_APP_SECRET || process.env.META_WHATSAPP_APP_SECRET || process.env.META_APP_SECRET);
  const verifyTokenConfigured = Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WHATSAPP_VERIFY_TOKEN);
  const triggerRuntimeConfigured = String((integration?.configuration as Json | null)?.runtime_route || "trigger_dev") === "trigger_dev";
  let meta: Json | null = null;
  let metaError = "";

  if (credentials) {
    try { meta = await verifyMetaPhoneNumber(credentials); }
    catch (error) { metaError = error instanceof Error ? error.message : "Meta verification failed."; }
  }

  const phoneNumberId = credentials ? String(credentials.phone_number_id || credentials.phoneNumberId || "") : "";
  const checks = [
    { key: "credentials", ok: Boolean(phoneNumberId && credentials?.access_token), detail: credentialSource === "tenant_vault" ? "Tenant-scoped credentials found in Vault." : credentialSource === "legacy_env" ? "Using legacy Limitless Realty environment credentials." : "Credentials are missing." },
    { key: "meta_phone", ok: Boolean(meta), detail: meta ? "Meta accepted the configured phone number credentials." : (metaError || "Meta phone verification has not passed.") },
    { key: "webhook_signature", ok: appSecretConfigured, detail: appSecretConfigured ? "Webhook app secret is configured." : "Webhook app secret is missing." },
    { key: "verify_token", ok: verifyTokenConfigured, detail: verifyTokenConfigured ? "Webhook verify token is configured." : "Webhook verify token is missing." },
    { key: "trigger_runtime", ok: triggerRuntimeConfigured, detail: triggerRuntimeConfigured ? "Trigger.dev is the configured runtime route." : "Trigger.dev is not selected as the runtime route." },
  ];

  const readyForCutover = checks.every((check) => check.ok);
  const health = {
    status: readyForCutover ? "healthy" : "attention_required",
    ready_for_cutover: readyForCutover,
    credential_source: credentialSource,
    checks,
    meta_phone: meta || null,
  };

  if (integration?.id) {
    try {
      await admin.from("organization_integrations").update({
        health,
        last_checked_at: new Date().toISOString(),
        status: readyForCutover ? "connected" : integration.status,
        ...(readyForCutover ? { last_connected_at: new Date().toISOString() } : {}),
      }).eq("id", integration.id);
    } catch {
      // Readiness reporting must not fail merely because health persistence failed.
    }
  }

  return {
    organizationId,
    configured: Boolean(credentials),
    credentialSource,
    phoneNumberId: phoneNumberId || null,
    displayPhoneNumber: meta?.display_phone_number ? String(meta.display_phone_number) : null,
    verifiedName: meta?.verified_name ? String(meta.verified_name) : null,
    qualityRating: meta?.quality_rating ? String(meta.quality_rating) : null,
    accountStatus: meta?.status ? String(meta.status) : null,
    webhookSecretConfigured: appSecretConfigured,
    verifyTokenConfigured,
    triggerRuntimeConfigured,
    readyForCutover,
    checks,
  };
}
