import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("weekly Flux Social plan automatically queues carousels but not publishing", () => {
  const actions = read("app/dashboard/social/actions.ts");
  assert.match(actions, /created\.format !== "carousel"/);
  assert.match(actions, /tasks\.trigger\("flux-social-render-carousel"/);
  assert.match(actions, /carousel_render_status: "queued"/);
  assert.doesNotMatch(actions, /tasks\.trigger\("flux-social-publish-post"/);
});

test("Fluxknight carousel template and ordering are preserved", () => {
  const renderer = read("lib/social-carousels.tsx");
  const worker = read("src/trigger/social-carousel-renderer.tsx");
  const publisher = read("src/trigger/social-publisher.ts");
  assert.match(renderer, /FLUX_SOCIAL_CAROUSEL_TEMPLATE = "fluxknight-social-carousel-v1"/);
  assert.match(renderer, /position: i \+ 1/);
  assert.match(worker, /FLUX_SOCIAL_CAROUSEL_TEMPLATE/);
  assert.match(worker, /carousel_asset_ids: ids/);
  assert.match(worker, /status: "review", approved_at: null/);
  assert.match(publisher, /asset\.metadata\?\.position \?\? asset\.metadata\?\.carousel_index/);
  assert.match(publisher, /activeCarouselIds\.includes\(asset\.id\)/);
  assert.match(publisher, /approved carousel slide set is incomplete/);
});

test("review preview and actions display only the active generated carousel", () => {
  const review = read("app/dashboard/social/review/page.tsx");
  assert.match(review, /activeCarouselIds\.includes\(asset\.id\)/);
  assert.match(review, /Carousel slides are being generated automatically/);
  assert.match(review, /Generate carousel manually/);
});
