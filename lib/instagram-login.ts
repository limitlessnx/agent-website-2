import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { permissions } from "@/lib/meta-connection";

export const INSTAGRAM_LOGIN_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

const STATE_TTL_MS = 10 * 60 * 1000;

type StatePayload = {
  organizationId: string;
  issuedAt: number;
  nonce: string;
};

type Json = Record<string, unknown>;

function stateSecret() {
  const secret = (
    process.env.INSTAGRAM_OAUTH_STATE_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.LIMITLESS_ADMIN_PASSWORD
  );
  if (!secret) throw new Error("Instagram OAuth state secret is not configured.");
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", stateSecret()).update(payload).digest("base64url");
}

function safeEqual(leftValue: string, rightValue: string) {
  const left = Buffer.from(leftValue);
  const right = Buffer.from(rightValue);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createInstagramOAuthState(organizationId: string) {
  const payload: StatePayload = {
    organizationId,
    issuedAt: Date.now(),
    nonce: randomBytes(24).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyInstagramOAuthState(value: string | null) {
  if (!value) return null;
  const [encoded, signature, extra] = value.split(".");
  if (extra !== undefined) return null;
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as StatePayload;
    if (!payload.organizationId || !payload.issuedAt || !payload.nonce) return null;
    if (Date.now() - payload.issuedAt > STATE_TTL_MS) return null;
    if (payload.issuedAt - Date.now() > 60_000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildInstagramAuthorizationUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_LOGIN_SCOPES.join(","));
  url.searchParams.set("state", input.state);
  url.searchParams.set("force_reauth", "true");
  url.searchParams.set("enable_fb_login", "0");
  return url;
}

async function instagramJson(url: URL, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) {
    const message =
      typeof body.error_message === "string"
        ? body.error_message
        : typeof (body.error as Json | undefined)?.message === "string"
          ? String((body.error as Json).message)
          : `Instagram API request failed (${response.status}).`;
    throw new Error(message);
  }
  return body;
}

export async function exchangeInstagramCode(input: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
  apiVersion: string;
}) {
  const shortBody = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    code: input.code,
  });

  const shortBodyResponse = await instagramJson(
    new URL("https://api.instagram.com/oauth/access_token"),
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: shortBody,
    },
  );

  // Support current documented data-array and historical flat responses.
  const shortResponse = (Array.isArray(shortBodyResponse.data) ? shortBodyResponse.data[0] : shortBodyResponse) as Json | undefined;
  if (!shortResponse) throw new Error("Instagram returned no authorization data.");
  const shortAccessToken = String(shortResponse.access_token || "");
  if (!shortAccessToken) {
    throw new Error("Instagram did not return an access token.");
  }

  const longUrl = new URL(
    "https://graph.instagram.com/access_token",
  );
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", input.appSecret);
  longUrl.searchParams.set("access_token", shortAccessToken);
  const longResponse = await instagramJson(longUrl);
  const accessToken = String(longResponse.access_token || "");
  const expiresIn = Number(longResponse.expires_in);
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error("Instagram did not return a valid long-lived token.");

  const profileUrl = new URL(
    `https://graph.instagram.com/${input.apiVersion}/me`,
  );
  profileUrl.searchParams.set(
    "fields",
    "id,username,account_type,profile_picture_url",
  );
  profileUrl.searchParams.set("access_token", accessToken);
  const profile = await instagramJson(profileUrl);

  return {
    accessToken,
    expiresIn,
    userId: String(profile.id || shortResponse.user_id || ""),
    username: String(profile.username || ""),
    accountType: String(profile.account_type || ""),
    profilePictureUrl: String(profile.profile_picture_url || ""),
    returnedPermissions: permissions(shortResponse.permissions),
  };
}

export async function refreshInstagramToken(accessToken: string) {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);
  const result = await instagramJson(url);
  const expiresIn = Number(result.expires_in);
  if (typeof result.access_token !== "string" || !result.access_token || !Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error("Instagram did not return a valid renewed token.");
  return { accessToken: result.access_token, expiresIn };
}
