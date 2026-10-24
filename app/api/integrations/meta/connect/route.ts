import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getFluxknightOrganization, getMetaCredentials } from "@/lib/meta-integration";
import { buildMetaAuthorizationUrl } from "@/lib/meta-oauth";
import { createMetaOAuthState } from "@/lib/meta-oauth-state";

const PRODUCTION_ORIGIN = "https://fluxknight.space";

function oauthOrigin(request: Request) {
  return process.env.NODE_ENV === "production" ? PRODUCTION_ORIGIN : new URL(request.url).origin;
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
  const authorization = buildMetaAuthorizationUrl({
    apiVersion,
    appId,
    redirectUri,
    state,
    loginConfigurationId,
  });

  console.info("Meta OAuth connect started", {
    organizationId: organization.id,
    apiVersion,
    hasLoginConfigurationId: Boolean(loginConfigurationId),
    requestOrigin: new URL(request.url).origin,
    redirectOrigin: oauthOrigin(request),
    redirectUri,
  });

  return NextResponse.redirect(authorization);
}
