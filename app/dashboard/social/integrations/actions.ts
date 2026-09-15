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

  if (!appId || !appSecret) {
    redirect("/dashboard/social/integrations?error=Meta%20App%20ID%20and%20App%20Secret%20are%20required");
  }

  try {
    const organization = await getFluxknightOrganization();
    await saveMetaCredentials({ organizationId: organization.id, appId, appSecret });
    revalidatePath("/dashboard/social/integrations");
    redirect("/dashboard/social/integrations?meta=configured");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save Meta credentials.";
    redirect(`/dashboard/social/integrations?error=${encodeURIComponent(message.slice(0, 220))}`);
  }
}
