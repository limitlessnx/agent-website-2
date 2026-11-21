import { metaConnectionReadiness } from "@/lib/meta-connection";

type Json = Record<string, unknown>;

async function read(host: string, version: string, path: string, token: string, fields?: string): Promise<Json> {
  const url = new URL(`https://${host}/${version}/${path}`);
  if (fields) url.searchParams.set("fields", fields);
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const body = await response.json() as Json;
  if (!response.ok || body.error) throw new Error(`Provider connection check failed (${response.status}). Reconnect and review app access in Meta.`);
  return body;
}

/** GET-only provider checks. Never creates media containers, publishes, or changes schedules. */
export async function checkMetaConnection(config: Json, secrets: Json, status: string) {
  const verified = { ...config };
  const issues: string[] = [];
  const version = String(config.api_version || "v24.0");
  if (secrets.user_access_token && secrets.access_token && config.page_id) {
    try {
      const grants = await read("graph.facebook.com", version, "me/permissions", String(secrets.user_access_token));
      verified.granted_permissions = (Array.isArray(grants.data) ? grants.data : [])
        .filter((p: Json) => p.status === "granted").map((p: Json) => String(p.permission));
      const page = await read("graph.facebook.com", version, String(config.page_id), String(secrets.access_token), "id,name,instagram_business_account{id,username}");
      if (String(page.id) !== String(config.page_id)) throw new Error("Facebook Page identity did not match.");
      const instagram = page.instagram_business_account as Json | undefined;
      verified.page_name = page.name;
      verified.instagram_business_account_id = instagram?.id || null;
      verified.instagram_username = instagram?.username || null;
    } catch (error) {
      verified.granted_permissions = [];
      issues.push(error instanceof Error ? error.message : "Facebook check failed.");
    }
  } else issues.push("Facebook Page authorization is incomplete.");

  if (secrets.instagram_user_access_token) {
    try {
      const profile = await read("graph.instagram.com", String(config.instagram_api_version || version), "me", String(secrets.instagram_user_access_token), "id,username");
      if (String(profile.id) !== String(secrets.instagram_login_user_id || config.instagram_login_user_id)) throw new Error("Instagram identity did not match.");
    } catch (error) {
      verified.instagram_login_granted_permissions = [];
      issues.push(error instanceof Error ? error.message : "Instagram check failed.");
    }
  }
  const readiness = metaConnectionReadiness(verified, secrets, status);
  const ready = readiness.facebookReady && (readiness.instagramDirectReady || readiness.instagramViaFacebookReady);
  verified.instagram_publishing_ready = readiness.instagramDirectReady || readiness.instagramViaFacebookReady;
  return { configuration: verified, health: {
    status: ready ? "healthy" : "attention", checked_at: new Date().toISOString(),
    message: issues.join(" ") || (ready ? "Account identities checked. Instagram Login permissions use the saved OAuth grants. No content was posted." : "Connected account needs publishing grants. Reconnect after updating Meta app access."),
    facebook_publishing_ready: readiness.facebookReady,
    instagram_publishing_ready: readiness.instagramDirectReady || readiness.instagramViaFacebookReady,
  } };
}
