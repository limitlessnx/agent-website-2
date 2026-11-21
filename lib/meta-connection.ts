type Json = Record<string, unknown>;

export const FACEBOOK_PUBLISH_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"];
export const INSTAGRAM_FACEBOOK_SCOPES = ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"];
export const INSTAGRAM_DIRECT_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

export function permissions(value: unknown): string[] {
  return typeof value === "string" ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
}

export function tokenExpired(value: unknown, now = Date.now()) {
  if (typeof value !== "string" || !value) return false;
  const time = Date.parse(value);
  return !Number.isFinite(time) || time <= now;
}

/** Recorded capabilities, not a live provider health check. Never infer grants from requested scopes. */
export function metaConnectionReadiness(config: Json, secrets: Json, status: string) {
  const granted = permissions(config.granted_permissions);
  const directGranted = permissions(config.instagram_login_granted_permissions);
  const facebookMissing = FACEBOOK_PUBLISH_SCOPES.filter((p) => !granted.includes(p));
  const instagramMissing = INSTAGRAM_FACEBOOK_SCOPES.filter((p) => !granted.includes(p));
  const directMissing = INSTAGRAM_DIRECT_SCOPES.filter((p) => !directGranted.includes(p));
  const directId = String(secrets.instagram_login_user_id || config.instagram_login_user_id || "");
  const directExpiry = config.instagram_login_token_expires_at || secrets.instagram_login_token_expires_at;
  const directUsernameMatches = !config.instagram_username || normalize(config.instagram_username) === normalize(config.instagram_login_username || secrets.instagram_login_username);
  const directReady = status === "connected" && Boolean(secrets.instagram_user_access_token && directId && directExpiry) &&
    directUsernameMatches && !tokenExpired(directExpiry) && directMissing.length === 0;
  const targetMatches = !config.preferred_page_id || String(config.preferred_page_id) === String(config.page_id);
  const pageReady = status === "connected" && targetMatches && Boolean(secrets.access_token && config.page_id);
  return {
    facebookReady: pageReady && facebookMissing.length === 0,
    instagramViaFacebookReady: pageReady && Boolean(config.instagram_business_account_id) && instagramMissing.length === 0 &&
      (!config.preferred_instagram_account || [normalize(config.instagram_business_account_id), normalize(config.instagram_username)].includes(normalize(config.preferred_instagram_account))),
    instagramDirectReady: directReady,
    facebookMissing, instagramMissing, directMissing,
    directExpired: tokenExpired(directExpiry),
  };
}

export type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
};

const normalize = (v: unknown) => String(v || "").trim().replace(/^@/, "").toLowerCase();

export function selectMetaPage(pages: MetaPage[], preferences: Json) {
  const pageId = normalize(preferences.preferred_page_id);
  const instagram = normalize(preferences.preferred_instagram_account);
  const candidates = pages.filter((p) => (!pageId || normalize(p.id) === pageId) &&
    (!instagram || [normalize(p.instagram_business_account?.id), normalize(p.instagram_business_account?.username)].includes(instagram)));
  if (candidates.length !== 1) {
    throw new Error(candidates.length ? "Choose a Preferred Facebook Page ID before connecting multiple Pages."
      : "The authorized Page and linked Instagram account do not match the configured target. Check Page access and professional account linkage in Meta.");
  }
  if (!candidates[0].access_token) throw new Error("Meta did not return a Page access token. Reauthorize Page access.");
  return candidates[0];
}
