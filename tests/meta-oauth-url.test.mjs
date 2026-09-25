import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const connectRoute = readFileSync("app/api/integrations/meta/connect/route.ts", "utf8");
const oauthHelper = readFileSync("lib/meta-oauth.ts", "utf8");

test("Meta Business Login config_id flow forces authorization code redirects", () => {
  assert.match(oauthHelper, /searchParams\.set\("config_id", loginConfigurationId\)/);
  assert.match(
    oauthHelper,
    /searchParams\.set\("override_default_response_type", "true"\)/,
  );
  assert.doesNotMatch(
    connectRoute,
    /authorization\.searchParams\.set\("config_id"/,
    "connect route should use the shared builder so config_id behavior stays tested",
  );
});

test("Meta classic OAuth fallback still requests publishing scopes explicitly", () => {
  for (const scope of [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
  ]) {
    assert.match(oauthHelper, new RegExp(`"${scope}"`));
  }
  assert.match(oauthHelper, /searchParams\.set\("scope", metaOauthScope\(\)\)/);
});
