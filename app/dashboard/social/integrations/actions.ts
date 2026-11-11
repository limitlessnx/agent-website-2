"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getFluxknightOrganization,
  getMetaCredentials,
  getMetaIntegration,
  saveMetaCredentials,
} from "@/lib/meta-integration";
import { runMetaAnalyticsSync } from "@/lib/social-meta-sync";
import { checkMetaConnection } from "@/lib/meta-health";
import { refreshInstagramToken } from "@/lib/instagram-login";
import { tokenExpired } from "@/lib/meta-connection";

export async function checkFluxknightMetaConnection() {
  if (!await getAdminSession()) redirect("/login?next=/dashboard/social/integrations");
  const organization = await getFluxknightOrganization();
  const [integration, secrets] = await Promise.all([getMetaIntegration(organization.id), getMetaCredentials(organization.id)]);
  const result = await checkMetaConnection((integration?.configuration || {}) as Record<string, unknown>, secrets || {}, integration?.status || "disconnected");
  const { error } = await createAdminClient().from("organization_integrations")
    .update({ ...result, last_checked_at: new Date().toISOString() })
    .eq("organization_id", organization.id).eq("provider", "meta");
  if (error) throw error;
  revalidatePath("/dashboard/social/integrations");
}

/** Explicit admin maintenance only; no new schedules or publishing side effects. */
export async function renewFluxknightInstagramToken() {
  if (!await getAdminSession()) redirect("/login?next=/dashboard/social/integrations");
  let destination = "/dashboard/social/integrations?instagram=renewed";
  try {
    const organization = await getFluxknightOrganization();
    const [integration, secrets] = await Promise.all([getMetaIntegration(organization.id), getMetaCredentials(organization.id)]);
    const config = (integration?.configuration || {}) as Record<string, unknown>;
    const expiry = config.instagram_login_token_expires_at || secrets?.instagram_login_token_expires_at;
    const issued = Date.parse(String(config.instagram_login_token_issued_at || secrets?.instagram_login_token_issued_at || ""));
    if (!secrets?.instagram_user_access_token || !expiry || tokenExpired(expiry)) throw new Error("Instagram token is missing or expired. Reconnect Instagram Publishing.");
    if (!Number.isFinite(issued) || Date.now() - issued < 24 * 60 * 60 * 1000) throw new Error("Renewal requires a token at least 24 hours old. Reconnect if the issue time is unknown.");
    const renewed = await refreshInstagramToken(String(secrets.instagram_user_access_token));
    const expiresAt = new Date(Date.now() + renewed.expiresIn * 1000).toISOString();
    const issuedAt = new Date().toISOString();
    const { error } = await createAdminClient().rpc("store_organization_integration_credentials", {
      p_organization_id: organization.id, p_provider: "meta", p_display_name: "Meta",
      p_credentials: { ...secrets, instagram_user_access_token: renewed.accessToken, instagram_login_token_expires_at: expiresAt, instagram_login_token_issued_at: issuedAt },
      p_configuration: { ...config, instagram_login_token_expires_at: expiresAt, instagram_login_token_issued_at: issuedAt },
    });
    if (error) throw error;
    revalidatePath("/dashboard/social/integrations");
  } catch {
    destination = "/dashboard/social/integrations?error=Instagram%20token%20could%20not%20be%20renewed.%20Use%20Reconnect%20Instagram%20Publishing%20if%20expired%2C%20or%20retry%20after%2024%20hours.";
  }
  redirect(destination);
}

export async function saveMetaAppCredentials(formData: FormData) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard/social/integrations");

  const appId = String(formData.get("appId") || "").trim();
  const appSecret = String(formData.get("appSecret") || "").trim();
  const loginConfigurationId = String(
    formData.get("loginConfigurationId") || "",
  ).trim();
  const preferredPageId = String(
    formData.get("preferredPageId") || "",
  ).trim();
  const preferredInstagramAccount = String(
    formData.get("preferredInstagramAccount") || "",
  ).trim();
  const instagramAppId = String(
    formData.get("instagramAppId") || "",
  ).trim();
  const instagramAppSecret = String(
    formData.get("instagramAppSecret") || "",
  ).trim();
  const instagramWebhookVerifyToken = String(
    formData.get("instagramWebhookVerifyToken") || "",
  ).trim();

  if (!appId) {
    redirect(
      "/dashboard/social/integrations?error=Meta%20App%20ID%20is%20required",
    );
  }

  try {
    const organization = await getFluxknightOrganization();
    await saveMetaCredentials({
      organizationId: organization.id,
      appId,
      appSecret,
      loginConfigurationId,
      preferredPageId,
      preferredInstagramAccount,
      instagramAppId,
      instagramAppSecret,
      instagramWebhookVerifyToken,
    });
    revalidatePath("/dashboard/social/integrations");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save Meta credentials.";
    redirect(
      `/dashboard/social/integrations?error=${encodeURIComponent(
        message.slice(0, 220),
      )}`,
    );
  }

  redirect("/dashboard/social/integrations?meta=configured");
}

export async function syncFluxknightMetaAnalytics() {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard/social/integrations");

  let destination = "/dashboard/social/integrations?error=Unable%20to%20sync%20Meta%20analytics";

  try {
    const organization = await getFluxknightOrganization();
    const admin = createAdminClient();

    const { data: brand, error: brandError } = await admin
      .from("social_brands")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("slug", "fluxknight")
      .maybeSingle();

    if (brandError) throw brandError;
    if (!brand?.id) throw new Error("Fluxknight social brand was not found.");

    const result = await runMetaAnalyticsSync({
      supabase: admin,
      organizationId: organization.id,
      brandId: brand.id,
    });

    revalidatePath("/dashboard/social/integrations");
    revalidatePath("/dashboard/social");
    destination =
      `/dashboard/social/integrations?meta=sync-complete&sync_status=${encodeURIComponent(
        result.ingestion.status,
      )}&account_samples=${result.collected.accountSamples}&post_samples=${result.collected.postSamples}`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to sync Meta analytics.";
    destination =
      `/dashboard/social/integrations?error=${encodeURIComponent(
        message.slice(0, 220),
      )}`;
  }

  redirect(destination);
}
