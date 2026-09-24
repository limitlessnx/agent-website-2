"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";
import { getFluxknightOrganization, saveMetaCredentials } from "@/lib/meta-integration";

export async function saveMetaAppCredentials(formData: FormData) {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard/social/integrations");

  const appId = String(formData.get("appId") || "").trim();
  const appSecret = String(formData.get("appSecret") || "").trim();
  const loginConfigurationId = String(formData.get("loginConfigurationId") || "").trim();
  const preferredPageId = String(formData.get("preferredPageId") || "").trim();
  const preferredInstagramAccount = String(formData.get("preferredInstagramAccount") || "").trim();

  if (!appId) {
    redirect("/dashboard/social/integrations?error=Meta%20App%20ID%20is%20required");
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
    const message = error instanceof Error ? error.message : "Unable to save Meta credentials.";
    redirect(`/dashboard/social/integrations?error=${encodeURIComponent(message.slice(0, 220))}`);
  }
  redirect("/dashboard/social/integrations?meta=configured");
}
