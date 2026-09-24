import { createAdminClient } from "@/lib/supabase/admin";

type Json = Record<string, unknown>;

export async function getFluxknightOrganization() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id,name,slug")
    .eq("slug", "fluxknight")
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Fluxknight organization was not found.");
  return data;
}

export async function getMetaCredentials(organizationId: string) {
  const admin = createAdminClient() as any;
  const { data, error } = await admin.rpc("get_organization_integration_credentials", {
    p_organization_id: organizationId,
    p_provider: "meta",
  });
  if (error) return null;
  return (data || null) as Json | null;
}

export async function getMetaIntegration(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_integrations")
    .select("id,provider,display_name,status,configuration,health,last_checked_at,last_connected_at,updated_at")
    .eq("organization_id", organizationId)
    .eq("provider", "meta")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveMetaCredentials(input: {
  organizationId: string;
  appId: string;
  appSecret?: string;
  loginConfigurationId?: string;
}) {
  const admin = createAdminClient() as any;
  const existingIntegration = await getMetaIntegration(input.organizationId);
  const existingCredentials = await getMetaCredentials(input.organizationId);
  const configuration = (existingIntegration?.configuration || {}) as Json;
  const existingAppSecret = String(existingCredentials?.app_secret || "");
  const appSecret = input.appSecret || existingAppSecret;
  const loginConfigurationId = input.loginConfigurationId || null;

  if (!appSecret) throw new Error("Meta App Secret is required for first-time setup.");

  const { error } = await admin.rpc("store_organization_integration_credentials", {
    p_organization_id: input.organizationId,
    p_provider: "meta",
    p_display_name: "Meta",
    p_credentials: {
      ...(existingCredentials || {}),
      app_id: input.appId,
      app_secret: appSecret,
      login_configuration_id: loginConfigurationId,
    },
    p_configuration: {
      ...configuration,
      app_id: input.appId,
      login_configuration_id: loginConfigurationId,
      credentials_updated_at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}
