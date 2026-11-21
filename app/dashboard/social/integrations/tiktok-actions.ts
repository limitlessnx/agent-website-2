"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";
import { getFluxknightOrganization } from "@/lib/meta-integration";
import { saveTikTokCredentials } from "@/lib/tiktok-integration";

export async function saveFluxSocialTikTokApp(formData: FormData) {
  if (!(await getAdminSession())) redirect("/login?next=/dashboard/social/integrations");
  const clientKey = String(formData.get("clientKey") || "").trim();
  const clientSecret = String(formData.get("clientSecret") || "").trim();
  try {
    const org = await getFluxknightOrganization();
    await saveTikTokCredentials({
      organizationId: org.id,
      clientKey: clientKey || undefined,
      clientSecret: clientSecret || undefined,
    });
    revalidatePath("/dashboard/social/integrations");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save TikTok credentials.";
    redirect("/dashboard/social/integrations?tiktok_error=" + encodeURIComponent(message.slice(0, 180)));
  }
  redirect("/dashboard/social/integrations?tiktok=configured");
}
