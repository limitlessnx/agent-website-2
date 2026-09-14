import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/admin-auth";

const COOKIE = "__Host-flux_meta_oauth_state";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.redirect(new URL("/admin/login", request.url));

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL("/dashboard/settings/integrations?error=Meta%20app%20credentials%20are%20not%20configured", request.url));
  }

  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  const apiVersion = process.env.META_GRAPH_API_VERSION || "v24.0";
  const redirectUri = new URL("/api/integrations/meta/callback", request.url).toString();
  const scope = process.env.META_OAUTH_SCOPES || "pages_show_list,pages_read_engagement,read_insights,instagram_basic,instagram_manage_insights";
  const authorization = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
  authorization.searchParams.set("client_id", appId);
  authorization.searchParams.set("redirect_uri", redirectUri);
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("scope", scope);
  authorization.searchParams.set("response_type", "code");

  return NextResponse.redirect(authorization);
}
