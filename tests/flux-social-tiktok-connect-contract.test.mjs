import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const integration = read("lib/tiktok-integration.ts");
const connect = read("app/api/integrations/tiktok/connect/route.ts");
const callback = read("app/api/integrations/tiktok/callback/route.ts");
const page = read("app/dashboard/social/integrations/page.tsx");
const existingPlatforms = read("lib/social.ts");

test("TikTok account connects only through admin-authenticated OAuth", () => {
  assert.match(connect, /getAdminSession/);
  assert.match(callback, /getAdminSession/);
  assert.match(connect, /randomBytes\(32\)/);
  assert.match(connect, /httpOnly: true/);
  assert.match(connect, /sameSite: "lax"/);
  assert.match(callback, /returnedState !== expectedState/);
  assert.match(connect, /scope", "user\.info\.basic"/);
});

test("TikTok secrets remain in existing Supabase Vault integration", () => {
  assert.match(integration, /store_organization_integration_credentials/);
  assert.match(integration, /get_organization_integration_credentials/);
  assert.match(integration, /p_provider: "tiktok"/);
  assert.match(integration, /organizationId !== organization\.id/);
  assert.match(integration, /status: oauthComplete \? "connected" : "configured"/);
  assert.match(callback, /userData\.open_id/);
  assert.doesNotMatch(page, /tikTokCredentials\?\.access_token\s*\}/);
});

test("TikTok is visible in integrations but not silently enabled for publishing", () => {
  assert.match(page, /Connect TikTok account/);
  assert.match(page, /publishing/i);
  assert.match(callback, /publishing_enabled: false/);
  assert.doesNotMatch(existingPlatforms, /"tiktok"/);
});

test("OAuth callback URI is stable and not user-controlled", () => {
  assert.match(integration, /https:\/\/fluxknight\.space\/api\/integrations\/tiktok\/callback/);
  assert.match(connect, /TIKTOK_REDIRECT_URI/);
  assert.match(callback, /TIKTOK_REDIRECT_URI/);
});
