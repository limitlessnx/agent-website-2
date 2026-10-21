import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("workspace dashboard greeting uses resolved organization instead of hard-coded Limitless",()=>{
  const page=read("app/dashboard/page.tsx");
  assert.match(page,/name=\{snapshot\.organizationName \|\| "Fluxknight"\}/);
  assert.doesNotMatch(page,/name="Limitless"/);
});

test("organization scope has distinct Fluxknight, Limitless Realty and Gencouv system identities",()=>{
  const context=read("lib/admin-organization-context.ts");
  const scope=read("lib/admin-organization-scope.ts");
  assert.match(context,/"fluxknight"/);
  assert.match(context,/"limitless-realty"/);
  assert.match(context,/"gencouv"/);
  assert.match(scope,/SYSTEM_SLUGS/);
});

test("Google OAuth preserves a safe next path and validates the application session before redirect",()=>{
  const start=read("app/api/client-auth/google/start/route.ts");
  const callback=read("app/auth/callback/route.ts");
  assert.match(start,/safeNext/);
  assert.match(start,/redirectTo:callback\.toString\(\)/);
  assert.match(callback,/exchangeCodeForSession/);
  assert.match(callback,/getClientSession/);
  assert.match(callback,/google_session/);
  assert.match(callback,/destination\(origin,nextPath/);
});

test("account-mode endpoint can recover pending setup from the verified Supabase session",()=>{
  const route=read("app/api/client-auth/account-mode/route.ts");
  assert.match(route,/supabase\.auth\.getUser\(\)/);
  assert.match(route,/setPendingClientSetupSession/);
  assert.doesNotMatch(route,/body\.userId|body\.email/);
});

test("new organization owner choice preserves setup state and sends workspace creation to portal",()=>{
  const choice=read("app/api/client-auth/account-mode/route.ts");
  const setup=read("app/api/client-auth/setup-workspace/route.ts");
  const signup=read("app/api/client-auth/signup/route.ts");
  assert.match(choice,/nextPath:\s*"\/portal"/);
  assert.match(setup,/:\s*"\/portal"/);
  assert.match(signup,/nextPath:"\/portal"/);
});

test("organization choice UI uses explicit accessible action cards and pending/error states",()=>{
  const ui=read("app/account/choose-mode/AccountModeClient.tsx");
  const css=read("app/account/choose-mode/AccountModeClient.module.css");
  assert.match(ui,/Start an Organization/);
  assert.match(ui,/Manage Organizations/);
  assert.match(ui,/aria-busy=/);
  assert.match(ui,/role="alert"/);
  assert.match(css,/\.choiceCard:focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
});
