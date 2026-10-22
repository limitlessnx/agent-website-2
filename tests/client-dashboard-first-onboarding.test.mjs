import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("new clients complete only identity setup before entering the dashboard", () => {
  const form = read("app/account/setup/SetupForm.tsx");
  const route = read("app/api/client-auth/setup-workspace/route.ts");
  assert.match(form, /Your name/);
  assert.match(form, /Organization name/);
  assert.match(form, /open dashboard/);
  assert.doesNotMatch(form, /industry_slug/);
  assert.match(route, /service-businesses/);
  assert.match(route, /redirect_to/);
  assert.match(route, /\/portal/);
});

test("signup keeps the accepted client path dashboard-first", () => {
  const signup = read("app/api/client-auth/signup/route.ts");
  assert.match(signup, /nextPath:\"\/portal\"/);
  assert.match(signup, /requires_workspace_setup:true/);
});

test("dashboard-first acceptance does not publish customer-facing AI automatically", () => {
  const route = read("app/api/client-auth/setup-workspace/route.ts");
  assert.doesNotMatch(route, /publish|activate.*agent|status:\s*["']live/);
  assert.match(route, /provisionClientWorkspace/);
});
