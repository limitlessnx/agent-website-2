import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const auth = fs.readFileSync("lib/admin-auth.ts", "utf8");

test("admin session signing supports the legacy password environment variable", () => {
  assert.match(auth, /process\.env\.ADMIN_PASSWORD/);
  assert.match(auth, /process\.env\.NODE_ENV === "production" \? ""/);
});

test("admin session verification fails closed when no signing secret is configured", () => {
  assert.match(auth, /if \(!secret\) throw new Error/);
  assert.match(auth, /if \(!token \|\| !sessionSecret\(\)\) return null/);
});
