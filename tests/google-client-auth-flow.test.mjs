import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("Google OAuth canonicalizes production www to the apex host",()=>{
  const route=read("app/api/client-auth/google/start/route.ts");
  assert.match(route,/www\.fluxknight\.space/);
  assert.match(route,/canonical\.hostname="fluxknight\.space"/);
  assert.match(route,/Preview deployments/);
});

test("Google OAuth callback creates and verifies the Fluxknight client session before dashboard redirect",()=>{
  const route=read("app/auth/callback/route.ts");
  assert.match(route,/setClientSession/);
  assert.match(route,/getClientSession/);
  assert.match(route,/google_session/);
  assert.match(route,/clientSession\.userId!==data\.user\.id/);
  assert.match(route,/clientSession\.membershipId!==membership\.membershipId/);
});

test("Google OAuth preserves setup for accounts without an existing membership",()=>{
  const route=read("app/auth/callback/route.ts");
  assert.match(route,/setPendingClientSetupSession/);
  assert.match(route,/\/account\/setup/);
});

test("Google OAuth context remains signed and short-lived",()=>{
  const auth=read("lib/client-auth.ts");
  assert.match(auth,/CLIENT_OAUTH_CONTEXT_TTL=60\*10/);
  assert.match(auth,/setClientOAuthContext/);
  assert.match(auth,/getClientOAuthContext/);
  assert.match(auth,/createSignedToken/);
});
