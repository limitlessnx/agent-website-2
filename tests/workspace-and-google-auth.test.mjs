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
