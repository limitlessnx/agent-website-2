import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getTikTokIntegration, getTikTokCredentials, TIKTOK_REDIRECT_URI } from "@/lib/tiktok-integration";

const COOKIE = "__Host-flux_tiktok_oauth_state";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.redirect("https://fluxknight.space/login?next=/dashboard/social/integrations");
  }
  const { organization } = await getTikTokIntegration();
  const credentials = await getTikTokCredentials(organization.id);
  const clientKey = String(credentials?.client_key || "");
  const clientSecret = String(credentials?.client_secret || "");
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect("https://fluxknight.space/dashboard/social/integrations?tiktok_error=Configure%20TikTok%20developer%20credentials%20first");
  }
  const state = randomBytes(32).toString("hex");
  (await cookies()).set(COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("response_type", "code");
  // Login first; the Content Posting API scope is requested only if the app
  // has been approved for it. No publication is initiated by OAuth.
  url.searchParams.set("scope", "user.info.basic");
  url.searchParams.set("redirect_uri", TIKTOK_REDIRECT_URI);
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
