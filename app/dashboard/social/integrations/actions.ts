"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getFluxknightOrganization,
  saveMetaCredentials,
} from "@/lib/meta-integration";
import { runMetaAnalyticsSync } from "@/lib/social-meta-sync";

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
