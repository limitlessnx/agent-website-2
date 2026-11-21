const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function load(file, mocks = {}) {
  const filename = resolve(file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  const baseRequire = mod.require.bind(mod);
  mod.require = (name) => Object.hasOwn(mocks, name) ? mocks[name]
    : name.startsWith("@/") ? load(name.slice(2) + ".ts", mocks) : baseRequire(name);
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText, filename);
  return mod.exports;
}

const connection = load("lib/meta-connection.ts");
const validConfig = {
  page_id: "page", instagram_business_account_id: "linked-ig",
  granted_permissions: [...connection.FACEBOOK_PUBLISH_SCOPES, ...connection.INSTAGRAM_FACEBOOK_SCOPES],
};
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("production's analytics-only grants do not authorize publishing", () => {
  const result = connection.metaConnectionReadiness({ ...validConfig, granted_permissions: ["pages_show_list", "instagram_basic", "pages_read_engagement"] }, { access_token: "fake" }, "connected");
  assert.equal(result.facebookReady, false);
  assert.equal(result.instagramViaFacebookReady, false);
  assert.ok(result.facebookMissing.includes("pages_manage_posts"));
});

test("direct Instagram is independent of Facebook and needs real grants and unexpired token", () => {
  const config = { instagram_login_user_id: "direct-id", instagram_login_granted_permissions: connection.INSTAGRAM_DIRECT_SCOPES, instagram_login_token_expires_at: new Date(Date.now()+60000).toISOString() };
  assert.equal(connection.metaConnectionReadiness(config, { instagram_user_access_token: "fake" }, "connected").instagramDirectReady, true);
  for (const override of [{ instagram_login_granted_permissions: [] }, { instagram_login_token_expires_at: "2000-01-01" }, { instagram_login_token_expires_at: null }]) {
    assert.equal(connection.metaConnectionReadiness({ ...config, ...override }, { instagram_user_access_token: "fake" }, "connected").instagramDirectReady, false);
  }
});

test("Page targeting fails closed on ambiguity, mismatch and missing Page token", () => {
  const pages = [{ id: "one", access_token: "fake", instagram_business_account: { id: "ig-one", username: "brand" } }, { id: "two", access_token: "fake" }];
  assert.throws(() => connection.selectMetaPage(pages, {}), /Preferred/);
  assert.throws(() => connection.selectMetaPage(pages, { preferred_page_id: "two", preferred_instagram_account: "brand" }), /do not match/);
  assert.equal(connection.selectMetaPage(pages, { preferred_page_id: "one", preferred_instagram_account: "@brand" }).id, "one");
  assert.throws(() => connection.selectMetaPage([{ id: "one" }], {}), /Page access token/);
  assert.equal(connection.metaConnectionReadiness({ ...validConfig, preferred_instagram_account: "different-account" }, { access_token: "fake" }, "connected").instagramViaFacebookReady, false);
});

for (const shape of ["data", "flat"]) test(`Instagram exchange accepts ${shape} authorization response without inventing grants`, async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const short = { access_token: "fake-short", user_id: "direct", permissions: "instagram_business_basic" };
    const body = calls.length === 1 ? shape === "data" ? { data: [short] } : short
      : calls.length === 2 ? { access_token: "fake-long", expires_in: 5000 }
      : { id: "direct", username: "brand", account_type: "BUSINESS" };
    return Response.json(body);
  };
  const { exchangeInstagramCode } = load("lib/instagram-login.ts");
  const result = await exchangeInstagramCode({ appId: "app", appSecret: "fake-secret", code: "fake-code", redirectUri: "https://fluxknight.space/api/integrations/meta/instagram/callback", apiVersion: "v24.0" });
  assert.equal(result.accessToken, "fake-long");
  assert.deepEqual(result.returnedPermissions, ["instagram_business_basic"]);
  assert.equal(new URL(calls[1].url).pathname, "/access_token");
  assert.equal(calls[0].init.method, "POST");
});

test("failed long-lived exchange never stores a short token as durable", async () => {
  let call = 0;
  global.fetch = async () => Response.json(++call === 1 ? { access_token: "fake-short" } : {});
  await assert.rejects(load("lib/instagram-login.ts").exchangeInstagramCode({ appId: "a", appSecret: "s", code: "c", redirectUri: "https://fluxknight.space/callback", apiVersion: "v24.0" }), /long-lived/);
});

test("webhooks reject forged, missing and altered signatures", () => {
  const { createHmac } = require("node:crypto");
  const { verifyMetaWebhook } = load("lib/meta-webhook.ts");
  const body = JSON.stringify({ object: "instagram" });
  const signature = "sha256="+createHmac("sha256", "fake-secret").update(body).digest("hex");
  assert.equal(verifyMetaWebhook(body, signature, "fake-secret"), true);
  assert.equal(verifyMetaWebhook(body+" ", signature, "fake-secret"), false);
  assert.equal(verifyMetaWebhook(body, null, "fake-secret"), false);
});

test("health check only reads identities and permissions; never posts or leaks tokens", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(calls.length === 1 ? { data: validConfig.granted_permissions.map(permission => ({ permission, status: "granted" })) }
      : { id: "page", instagram_business_account: { id: "linked-ig", username: "brand" } });
  };
  const result = await load("lib/meta-health.ts").checkMetaConnection(validConfig, { user_access_token: "fake-user", access_token: "fake-page" }, "connected");
  assert.equal(result.health.facebook_publishing_ready, true);
  assert.equal(result.health.instagram_publishing_ready, true);
  assert.ok(calls.every(c => !c.init.method || c.init.method === "GET"));
  assert.ok(calls.every(c => !c.url.includes("fake-")));
  assert.ok(!JSON.stringify(result).includes("fake-"));
});

test("publisher pairs direct ids with direct tokens and Facebook-linked ids with Page tokens", async () => {
  function database(config, secrets) {
    const client = { rpc: async () => ({ data: secrets }), from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { status: "connected", configuration: config } }) }) };
    return client;
  }
  const { metaPublisherConfigFromIntegration } = load("lib/social-meta-publisher.ts");
  const direct = { instagram_login_user_id: "direct-id", instagram_login_granted_permissions: connection.INSTAGRAM_DIRECT_SCOPES, instagram_login_token_expires_at: new Date(Date.now()+60000).toISOString() };
  const directResult = await metaPublisherConfigFromIntegration(database(direct, { instagram_user_access_token: "fake-direct" }), "org");
  assert.equal(directResult.instagramBusinessAccountId, "direct-id");
  assert.equal(directResult.instagramGraphHost, "graph.instagram.com");
  const pageResult = await metaPublisherConfigFromIntegration(database({ ...validConfig, instagram_login_user_id: "stale-direct-id" }, { access_token: "fake-page" }), "org");
  assert.equal(pageResult.instagramBusinessAccountId, "linked-ig");
  assert.equal(pageResult.instagramGraphHost, "graph.facebook.com");
});

test("Instagram callback requires admin session and the initiating browser cookie before exchange", async () => {
  let exchanges = 0;
  const mocks = {
    "next/server": { NextResponse: { redirect: url => ({ location: String(url) }) } },
    "next/headers": { cookies: async () => ({ get: () => undefined, delete() {} }) },
    "@/lib/admin-auth": { getAdminSession: async () => null },
    "@/lib/supabase/admin": { createAdminClient: () => { throw new Error("must not store"); } },
    "@/lib/meta-integration": {},
    "@/lib/instagram-login": { verifyInstagramOAuthState: () => ({ organizationId: "org" }), exchangeInstagramCode: () => { exchanges++; } },
  };
  const request = new Request("https://fluxknight.space/api/integrations/meta/instagram/callback?code=fake&state=fake");
  let result = await load("app/api/integrations/meta/instagram/callback/route.ts", mocks).GET(request);
  assert.match(new URL(result.location).searchParams.get("error"), /Admin session required/);
  mocks["@/lib/admin-auth"].getAdminSession = async () => ({ email: "admin@example.test" });
  result = await load("app/api/integrations/meta/instagram/callback/route.ts", mocks).GET(request);
  assert.match(new URL(result.location).searchParams.get("error"), /invalid or expired/);
  assert.equal(exchanges, 0);
});

test("saving app-only settings does not mark a new integration connected or healthy", async () => {
  const updates = [];
  const client = {
    from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null }), update(value) { updates.push(value); return this; } }),
    rpc: async () => ({ data: null, error: null }),
  };
  await load("lib/meta-integration.ts", { "@/lib/supabase/admin": { createAdminClient: () => client } })
    .saveMetaCredentials({ organizationId: "org", appId: "app", appSecret: "fake-secret" });
  assert.equal(updates[0].status, "configured");
  assert.equal(updates[0].health.status, "pending");
  assert.equal(updates[0].last_connected_at, null);
});
