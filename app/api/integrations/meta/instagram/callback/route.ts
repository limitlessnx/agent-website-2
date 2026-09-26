import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getFluxknightOrganization,
  getMetaCredentials,
  getMetaIntegration,
} from "@/lib/meta-integration";
import {
  exchangeInstagramCode,
  INSTAGRAM_LOGIN_SCOPES,
  verifyInstagramOAuthState,
} from "@/lib/instagram-login";

const PRODUCTION_ORIGIN = "https://fluxknight.space";
type Json = Record<string, unknown>;

function oauthOrigin(request: Request) {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_ORIGIN
    : new URL(request.url).origin;
}

function back(request: Request, key: "instagram" | "error", value: string) {
  const url = new URL("/dashboard/social/integrations", oauthOrigin(request));
  url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");
    const oauthError =
      requestUrl.searchParams.get("error_description") ||
      requestUrl.searchParams.get("error_message") ||
      requestUrl.searchParams.get("error");

    if (oauthError) return back(request, "error", oauthError);

    const state = verifyInstagramOAuthState(returnedState);
    if (!code || !state) {
      return back(
        request,
        "error",
        "Instagram authorization state was invalid or expired",
      );
    }

    const organization = await getFluxknightOrganization();
    if (state.organizationId !== organization.id) {
      return back(
        request,
        "error",
        "Instagram authorization organization did not match",
      );
    }

    const [credentials, integration] = await Promise.all([
      getMetaCredentials(organization.id),
      getMetaIntegration(organization.id),
    ]);
    const config = (integration?.configuration || {}) as Json;
    const appId = String(credentials?.instagram_app_id || "").trim();
    const appSecret = String(credentials?.instagram_app_secret || "").trim();

    if (!appId || !appSecret) {
      return back(
        request,
        "error",
        "Instagram publishing credentials are not configured",
      );
    }

    const apiVersion = String(
      config.instagram_api_version ||
        process.env.INSTAGRAM_GRAPH_API_VERSION ||
        "v24.0",
    );
    const redirectUri = new URL(
      "/api/integrations/meta/instagram/callback",
      oauthOrigin(request),
    ).toString();

    const result = await exchangeInstagramCode({
      appId,
      appSecret,
      redirectUri,
      code,
      apiVersion,
    });

    if (!result.userId) {
      throw new Error("Instagram did not return the connected account ID.");
    }

    const expectedUsername = String(config.instagram_username || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    if (
      expectedUsername &&
      result.username &&
      result.username.toLowerCase() !== expectedUsername
    ) {
      throw new Error(
        `Connected Instagram account @${result.username} does not match @${expectedUsername}.`,
      );
    }

    const expiresAt = result.expiresIn
      ? new Date(Date.now() + result.expiresIn * 1000).toISOString()
      : null;
    const admin = createAdminClient() as any;
    const { error } = await admin.rpc(
      "store_organization_integration_credentials",
      {
        p_organization_id: organization.id,
        p_provider: "meta",
        p_display_name: "Meta",
        p_credentials: {
          ...(credentials || {}),
          instagram_user_access_token: result.accessToken,
          instagram_login_user_id: result.userId,
          instagram_login_username: result.username || null,
          instagram_login_token_expires_at: expiresAt,
        },
        p_configuration: {
          ...config,
          instagram_login_connected_at: new Date().toISOString(),
          instagram_login_user_id: result.userId,
          instagram_login_username: result.username || null,
          instagram_login_account_type: result.accountType || null,
          instagram_login_profile_picture_url:
            result.profilePictureUrl || null,
          instagram_login_token_expires_at: expiresAt,
          instagram_login_granted_permissions:
            result.returnedPermissions.length
              ? result.returnedPermissions
              : [...INSTAGRAM_LOGIN_SCOPES],
          instagram_publishing_ready:
            result.returnedPermissions.includes(
              "instagram_business_content_publish",
            ) || INSTAGRAM_LOGIN_SCOPES.includes(
              "instagram_business_content_publish",
            ),
          instagram_api_version: apiVersion,
        },
      },
    );
    if (error) throw error;

    console.info("Instagram publishing OAuth completed", {
      organizationId: organization.id,
      instagramUserId: result.userId,
      username: result.username || null,
      expiresAt,
    });

    return back(request, "instagram", "connected");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to connect Instagram publishing.";
    console.error("Instagram publishing OAuth callback failed", { message });
    return back(request, "error", message.slice(0, 240));
  }
}
