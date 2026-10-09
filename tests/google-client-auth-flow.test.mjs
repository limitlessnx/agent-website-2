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


test("email login keeps nonexistent accounts on the login screen with a signup path",()=>{
  const route=read("app/api/client-auth/login/route.ts");
  const form=read("app/account/login/LoginForm.tsx");
  const auth=read("lib/client-auth.ts");
  assert.match(route,/clientAccountExists/);
  assert.match(route,/code:"account_not_found"/);
  assert.match(route,/No Fluxknight account exists for this email/);
  assert.match(route,/The email or password is incorrect/);
  assert.match(auth,/export async function clientAccountExists/);
  assert.match(auth,/auth\/v1\/admin/);
  assert.match(auth,/users\?page=1&per_page=1000/);
  assert.match(form,/errorCode === "account_not_found"/);
  assert.match(form,/Continue to create an account/);
  assert.match(form,/href=\{signupHref\}/);
});

test("email login still routes successful users to the requested destination",()=>{
  const form=read("app/account/login/LoginForm.tsx");
  assert.match(form,/router\\.push/);
  assert.match(form,/router\\.refresh/);
});


test("desktop auth cards use a shared centered geometry",()=>{
  const css=read("app/account/AuthExperience.module.css");
  assert.match(css,/@media \(min-width: 900px\)/);
  assert.match(css,/\.shell \{[\s\S]*?width: min\(100%, 720px\)/);
  assert.match(css,/\.card \{[\s\S]*?width: min\(100%, 560px\)/);
  assert.match(css,/\.signupCard \{[\s\S]*?width: min\(100%, 620px\)/);
});


test("new Google identities are told to continue account creation instead of being sent to the dashboard",()=>{
  const route=read("app/auth/callback/route.ts");
  const mode=read("app/account/choose-mode/AccountModeClient.tsx");
  assert.match(route,/\/account\/choose-mode\?source=google&new_account=1/);
  assert.match(mode,/Continue creating your account/);
  assert.match(mode,/Google identity is verified, but you have not finished creating your Fluxknight account/);
});
