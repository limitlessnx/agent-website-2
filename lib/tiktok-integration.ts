import { createAdminClient } from "@/lib/supabase/admin";
import { getFluxknightOrganization } from "@/lib/meta-integration";

type Json = Record<string, unknown>;

export const TIKTOK_REDIRECT_URI = "https://fluxknight.space/api/integrations/tiktok/callback";

export async function getTikTokIntegration() {
  const organization = await getFluxknightOrganization();
  const admin = createAdminClient();
  const { data, error } = await admin.from("organization_integrations")
    .select("id,status,configuration,health,last_connected_at")
    .eq("organization_id", organization.id)
    .eq("provider", "tiktok")
    .maybeSingle();
  if (error) throw error;
  return { organization, integration: data };
}

export async function getTikTokCredentials(organizationId: string): Promise<Json | null> {
  const admin = createAdminClient() as any;
  const { data, error } = await admin.rpc("get_organization_integration_credentials", {
    p_organization_id: organizationId,
    p_provider: "tiktok",
  });
  if (error) return null;
  return (data || null) as Json | null;
}

export async function saveTikTokCredentials(input: {
  organizationId: string;
  clientKey?: string;
  clientSecret?: string;
  tokenCredentials?: Json;
  configuration?: Json;
}) {
  const admin = createAdminClient() as any;
  const { organization, integration } = await getTikTokIntegration();
  if (input.organizationId !== organization.id) {
    throw new Error("TikTok connection must belong to Fluxknight.");
  }
  const original = await getTikTokCredentials(input.organizationId);
  const existing = (integration?.configuration || {}) as Json;
  const clientKey = input.clientKey || String(original?.client_key || "");
  const clientSecret = input.clientSecret || String(original?.client_secret || "");
  if (!clientKey || !clientSecret) throw new Error("TikTok developer Client Key and Client Secret are required.");
  const credentialsChanged = Boolean(original && (
    (input.clientKey && input.clientKey !== original.client_key) ||
    (input.clientSecret && input.clientSecret !== original.client_secret)
  ));
  const oauthComplete = Boolean(input.tokenCredentials?.access_token ||
    (!credentialsChanged && original?.access_token));

  const { error } = await admin.rpc("store_organization_integration_credentials", {
    p_organization_id: input.organizationId,
    p_provider: "tiktok",
    p_display_name: "TikTok",
    p_credentials: {
      ...(!credentialsChanged ? (original || {}) : {}),
      client_key: clientKey,
      client_secret: clientSecret,
      ...(input.tokenCredentials || {}),
    },
    p_configuration: {
      ...existing,
      client_key: clientKey,
      redirect_uri: TIKTOK_REDIRECT_URI,
      ...(!credentialsChanged ? {} : { oauth_connected_at: null, open_id: null, display_name: null }),
      ...(input.configuration || {}),
      updated_at: new Date().toISOString(),
    },
  });
  if (error) throw error;
  // The existing Vault RPC marks all credential saves as connected.
  // Reset status until actual account-owner OAuth has succeeded.
  const { error: statusError } = await admin.from("organization_integrations").update({
    status: oauthComplete ? "connected" : "configured",
    health: { status: oauthComplete ? "connected" : "authorization_required" },
    ...(!oauthComplete ? { last_connected_at: null } : {}),
  }).eq("organization_id", input.organizationId).eq("provider", "tiktok");
  if (statusError) throw statusError;
}
