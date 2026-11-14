import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Trigger carousel worker never bundles Next.js RSC-only OG wrapper", () => {
  const worker = read("src/trigger/social-carousel-renderer.tsx");
  const renderer = read("lib/social-carousels.tsx");
  assert.match(worker, /generateCarouselPlan, renderSlide/);
  assert.doesNotMatch(renderer, /from ["']next\/og["']/);
  assert.match(renderer, /from "next\/dist\/compiled\/@vercel\/og\/index\.node\.js"/);
  assert.match(renderer, /FLUX_SOCIAL_CAROUSEL_TEMPLATE = "fluxknight-social-carousel-v1"/);
  assert.match(renderer, /width: WIDTH, height: HEIGHT/);
});

test("Standalone Node ImageResponse API remains typed without runtime Next imports", () => {
  const types = read("types/trigger-vercel-og.d.ts");
  assert.match(types, /declare module "next\/dist\/compiled\/@vercel\/og\/index\.node\.js"/);
  assert.match(types, /export \{ ImageResponse \} from "next\/og"/);
});
