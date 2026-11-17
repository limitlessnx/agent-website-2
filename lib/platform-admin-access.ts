import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { createClient } from "@/lib/supabase/server";

export type AccountAuthResult = {
  access_token?: string;
  refresh_token?: string;
  user?: { id: string; email?: string; email_confirmed_at?: string | null };
};

/** User-editable profile metadata and tenant-owner roles never grant platform access. */
export async function isActivePlatformAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const rows = await supabaseServerRequest<
      Array<{ user_id: string; status: string }>
    >(
      `platform_super_admins?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=user_id,status&limit=1`,
    );
    return rows.some(
      (row) => row.user_id === userId && row.status === "active",
    );
  } catch {
    throw new Error(
      "Administrator access could not be verified. Please try again.",
    );
  }
}

export async function isVerifiedPlatformAdmin(user: AccountAuthResult["user"]) {
  return Boolean(
    user?.id &&
      user.email &&
      user.email_confirmed_at &&
      (await isActivePlatformAdmin(user.id)),
  );
}

/** Persist the provider session with the existing SSR cookie adapter. */
export async function establishAccountSession(auth: AccountAuthResult) {
  if (!auth.access_token || !auth.refresh_token || !auth.user?.id)
    throw new Error("Unable to establish your account session.");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });
  if (error || data.user?.id !== auth.user.id) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw new Error("Unable to establish your account session.");
  }
}
