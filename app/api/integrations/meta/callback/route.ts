import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFluxknightOrganization, getMetaCredentials } from "@/lib/meta-integration";

const COOKIE = "__Host-flux_meta_oauth_state";
const PRODUCTION_ORIGIN = "https://fluxknight.space";
type Json = Record<string, unknown>;

type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
};

function oauthOrigin(request: Request) {
  return process.env.NODE_ENV === "production" ? PRODUCTION_ORIGIN : new URL(request.url).origin;
}

function back(request: Request, key: "meta" | "error", value: string) {
  const url = new URL("/dashboard/social/integrations", oauthOrigin(request));
  url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

async function metaJson(url: URL) {
  const response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) {
    const error = body.error as Json | undefined;
    throw new Error(typeof error?.message === "string" ? error.message : `Meta request failed (${response.status}).`);
  }
  return body;
}

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return back(request, "error", "Admin session required");

    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");
    const metaError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error_message");

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(COOKIE)?.value;
    cookieStore.delete(COOKIE);

    if (metaError) return back(request, "error", metaError);
    if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
      return back(request, "error", "Meta authorization state was invalid or expired");
    }

    const organization = await getFluxknightOrganization();
    const storedCredentials = await getMetaCredentials(organization.id);
    const appId = String(storedCredentials?.app_id || "");
    const appSecret = String(storedCredentials?.app_secret || "");
    if (!appId || !appSecret) return back(request, "error", "Meta app credentials are not configured");

    const apiVersion = String(storedCredentials?.api_version || process.env.META_GRAPH_API_VERSION || "v24.0");
    const redirectUri = new URL("/api/integrations/meta/callback", oauthOrigin(request)).toString();

    const shortTokenUrl = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
    shortTokenUrl.searchParams.set("client_id", appId);
    shortTokenUrl.searchParams.set("client_secret", appSecret);
    shortTokenUrl.searchParams.set("redirect_uri", redirectUri);
    shortTokenUrl.searchParams.set("code", code);
    const shortToken = await metaJson(shortTokenUrl);
    const shortAccessToken = String(shortToken.access_token || "");
    if (!shortAccessToken) throw new Error("Meta did not return an access token.");

    const longTokenUrl = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
    longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longTokenUrl.searchParams.set("client_id", appId);
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("fb_exchange_token", shortAccessToken);
    const longToken = await metaJson(longTokenUrl);
    const userAccessToken = String(longToken.access_token || shortAccessToken);

    const pagesUrl = new URL(`https://graph.facebook.com/${apiVersion}/me/accounts`);
    pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username,name}");
    pagesUrl.searchParams.set("limit", "100");
    pagesUrl.searchParams.set("access_token", userAccessToken);
    const pagesBody = await metaJson(pagesUrl);
    const pages = (Array.isArray(pagesBody.data) ? pagesBody.data : []) as MetaPage[];
    const selected = pages.find((page) => page.instagram_business_account?.id) || pages[0];
    if (!selected?.id) throw new Error("No Facebook Page is available to this Meta account.");

    const pageToken = selected.access_token || userAccessToken;
    const configuration = {
      app_id: appId,
      page_id: selected.id,
      page_name: selected.name || null,
      instagram_business_account_id: selected.instagram_business_account?.id || null,
      instagram_username: selected.instagram_business_account?.username || null,
      api_version: apiVersion,
      oauth_connected_at: new Date().toISOString(),
    };

    const admin = createAdminClient() as any;
    const { error: storeError } = await admin.rpc("store_organization_integration_credentials", {
      p_organization_id: organization.id,
      p_provider: "meta",
      p_display_name: "Meta",
      p_credentials: {
        ...(storedCredentials || {}),
        app_id: appId,
        app_secret: appSecret,
        access_token: pageToken,
      },
      p_configuration: configuration,
    });
    if (storeError) throw storeError;

    return back(request, "meta", "connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to connect Meta.";
    return back(request, "error", message.slice(0, 240));
  }
}
