import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getFluxknightOrganization, getMetaCredentials } from "@/lib/meta-integration";
import { createMetaOAuthState } from "@/lib/meta-oauth-state";

const PRODUCTION_ORIGIN = "https://fluxknight.space";
const DEFAULT_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish"];
const ALLOWED_SCOPES = new Set(DEFAULT_SCOPES);

function oauthOrigin(request: Request) {
  return process.env.NODE_ENV === "production" ? PRODUCTION_ORIGIN : new URL(request.url).origin;
}

function metaOauthScope() {
  const configuredScopes = String(process.env.META_OAUTH_SCOPES || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const scopes = configuredScopes.filter((scope) => ALLOWED_SCOPES.has(scope));
  return (scopes.length ? scopes : DEFAULT_SCOPES).join(",");
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login?next=/dashboard/social/integrations", request.url));
  }

  const organization = await getFluxknightOrganization();
  const credentials = await getMetaCredentials(organization.id);
  const appId = String(credentials?.app_id || "");
  const appSecret = String(credentials?.app_secret || "");
  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/social/integrations?error=Meta%20app%20credentials%20are%20not%20configured",
        request.url,
      ),
    );
  }

  const state = createMetaOAuthState(organization.id);

  const apiVersion = String(credentials?.api_version || process.env.META_GRAPH_API_VERSION || "v24.0");
  const loginConfigurationId = String(
    credentials?.login_configuration_id || credentials?.config_id || "",
  ).trim();
  const redirectUri = new URL("/api/integrations/meta/callback", oauthOrigin(request)).toString();
  const authorization = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);

  console.info("Meta OAuth connect started", {
    requestOrigin: new URL(request.url).origin,
    redirectOrigin: oauthOrigin(request),
    usesBusinessLoginConfig: Boolean(loginConfigurationId),
    apiVersion,
  });

  authorization.searchParams.set("client_id", appId);
  authorization.searchParams.set("redirect_uri", redirectUri);
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("auth_type", "rerequest");

  if (loginConfigurationId) {
    authorization.searchParams.set("config_id", loginConfigurationId);
  } else {
    authorization.searchParams.set("scope", metaOauthScope());
  }

  return NextResponse.redirect(authorization);
}
