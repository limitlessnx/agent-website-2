import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getFluxknightOrganization,
  getMetaCredentials,
} from "@/lib/meta-integration";
import {
  buildInstagramAuthorizationUrl,
  createInstagramOAuthState,
} from "@/lib/instagram-login";

const PRODUCTION_ORIGIN = "https://fluxknight.space";

function oauthOrigin(request: Request) {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_ORIGIN
    : new URL(request.url).origin;
}

export async function GET(request: Request) {
  if (new URL(request.url).origin !== oauthOrigin(request)) return NextResponse.redirect(new URL("/api/integrations/meta/instagram/connect", oauthOrigin(request)));
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/login?next=/dashboard/social/integrations", request.url),
    );
  }

  const organization = await getFluxknightOrganization();
  const credentials = await getMetaCredentials(organization.id);
  const appId = String(credentials?.instagram_app_id || "").trim();
  const appSecret = String(credentials?.instagram_app_secret || "").trim();

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/social/integrations?error=Instagram%20App%20ID%20and%20App%20Secret%20are%20required",
        request.url,
      ),
    );
  }

  const redirectUri = new URL(
    "/api/integrations/meta/instagram/callback",
    oauthOrigin(request),
  ).toString();
  const state = createInstagramOAuthState(organization.id);
  (await cookies()).set(process.env.NODE_ENV === "production" ? "__Host-flux_instagram_oauth_state" : "flux_instagram_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600,
  });
  const authorization = buildInstagramAuthorizationUrl({
    appId,
    redirectUri,
    state,
  });

  console.info("Instagram publishing OAuth started", {
    organizationId: organization.id,
    redirectUri,
  });

  return NextResponse.redirect(authorization);
}
