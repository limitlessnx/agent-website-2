import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getTikTokCredentials,
  getTikTokIntegration,
  saveTikTokCredentials,
  TIKTOK_REDIRECT_URI,
} from "@/lib/tiktok-integration";

const COOKIE = "__Host-flux_tiktok_oauth_state";
type Json = Record<string, unknown>;

function back(key: "tiktok" | "tiktok_error", value: string) {
  const url = new URL("https://fluxknight.space/dashboard/social/integrations");
  url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  if (!(await getAdminSession())) return back("tiktok_error", "Admin session required");
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(COOKIE)?.value;
  cookieStore.delete(COOKIE);
  const returnedState = url.searchParams.get("state");
  if (!expectedState || !returnedState || returnedState !== expectedState) {
    return back("tiktok_error", "TikTok authorization session expired or invalid");
  }
  if (url.searchParams.has("error")) return back("tiktok_error", "TikTok authorization was not completed");
  const code = url.searchParams.get("code");
  if (!code) return back("tiktok_error", "TikTok did not return an authorization code");

  try {
    const { organization } = await getTikTokIntegration();
    const credentials = await getTikTokCredentials(organization.id);
    const clientKey = String(credentials?.client_key || "");
    const clientSecret = String(credentials?.client_secret || "");
    if (!clientKey || !clientSecret) throw new Error("TikTok app credentials are not configured");

    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: TIKTOK_REDIRECT_URI,
      }),
      cache: "no-store",
    });
    const token = (await tokenResponse.json().catch(() => ({}))) as Json;
    if (!tokenResponse.ok || typeof token.access_token !== "string" ||
        typeof token.refresh_token !== "string" || typeof token.open_id !== "string") {
      throw new Error("TikTok token exchange failed");
    }
    const scope = String(token.scope || "");
    const grantedScopes = scope.split(",").map((s) => s.trim()).filter(Boolean);
    if (!grantedScopes.includes("user.info.basic")) {
      throw new Error("TikTok basic identity permission was not granted");
    }

    const userResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const user = (await userResponse.json().catch(() => ({}))) as Json;
    const userData = user.data && typeof user.data === "object"
      ? ((user.data as Json).user || {}) as Json : {};
    if (!userResponse.ok || String(userData.open_id || "") !== token.open_id) {
      throw new Error("TikTok account identity verification failed");
    }

    const connectedAt = new Date().toISOString();
    await saveTikTokCredentials({
      organizationId: organization.id,
      tokenCredentials: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        open_id: token.open_id,
        scope,
        access_token_expires_at: new Date(Date.now() + Number(token.expires_in || 0) * 1000).toISOString(),
        refresh_token_expires_at: new Date(Date.now() + Number(token.refresh_expires_in || 0) * 1000).toISOString(),
      },
      configuration: {
        open_id: token.open_id,
        display_name: String(userData.display_name || "TikTok account"),
        avatar_url: String(userData.avatar_url || ""),
        granted_scopes: grantedScopes,
        oauth_connected_at: connectedAt,
        publishing_enabled: false,
        publishing_status: "not_configured",
      },
    });
    return back("tiktok", "connected");
  } catch (error) {
    console.error("TikTok OAuth callback failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return back("tiktok_error", "TikTok connection could not be completed. Check developer app permissions and callback configuration.");
  }
}
