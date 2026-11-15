import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const config = readFileSync(new URL("../trigger.config.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/trigger/social-carousel-renderer.tsx", import.meta.url), "utf8");

test("Trigger production bundles required renderer artifacts at worker image root", () => {
  assert.match(config, /path\.join\(manifest\.outputPath, "Geist-Regular\.ttf"\)/);
  assert.match(config, /path\.join\(manifest\.outputPath, "resvg\.wasm"\)/);
  assert.match(config, /await copyFile\(systemFont, bundledFont\)/);
  assert.match(config, /await copyFile\(sourceResvg, bundledResvg\)/);
  // Next is bundled, so its original node_modules tree is absent in outputPath.
  assert.match(config, /const sourceResvg = path\.join\(\s*context\.workingDir,/);
});

test("Trigger worker build fails if runtime font or WASM are not available", () => {
  assert.match(config, /await access\(systemFont\)/);
  assert.match(config, /await access\(sourceResvg\)/);
  assert.match(config, /await access\(bundledFont\)/);
  assert.match(config, /await access\(bundledResvg\)/);
  assert.match(config, /test -s \/app\/Geist-Regular\.ttf && test -s \/app\/resvg\.wasm/);
  assert.doesNotMatch(config, /ImageResponse resvg runtime was not available during Trigger artifact preparation/);
});

test("image renderer remains review-only and uses original template", () => {
  assert.match(worker, /id: "flux-social-render-carousel"/);
  assert.match(worker, /FLUX_SOCIAL_CAROUSEL_TEMPLATE/);
  assert.match(worker, /status: "review", approved_at: null/);
  assert.match(worker, /carousel_asset_ids: ids/);
});
