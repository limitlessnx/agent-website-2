import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("portal activation banner only appears for explicitly free workspaces without a subscription or trial", () => {
  const portal = fs.readFileSync("app/portal/page.tsx", "utf8");
  assert.match(portal, /\.from\("organizations"\)[\s\S]*?\.select\("metadata"\)[\s\S]*?\.eq\("id", session\.organizationId\)/);
  assert.match(portal, /workspaceMode === "free" && !subscription && !isTrial/);
  assert.doesNotMatch(portal, /const isFreeWorkspace = !subscription && !isTrial/);
});
