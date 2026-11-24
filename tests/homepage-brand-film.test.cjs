const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('homepage adds film without changing the existing customer journey order', () => {
  const homepage = read('app/page.tsx');
  assert.match(homepage, /<ProductLedHero\s*\/>\s*<BrandFilmSection\s*\/>\s*<AutomationJourney\s*\/>/);
  assert.match(homepage, /<IndustryExplorer\s*\/>/);
  assert.match(homepage, /<MeetLeoSection\s*\/>/);
});
test('film defaults to the approved official YouTube upload and accepts secure URL overrides', () => {
  const section = read('components/home/BrandFilmSection.tsx');
  assert.match(section, /NEXT_PUBLIC_FLUXKNIGHT_BRAND_FILM_YOUTUBE_URL/);
  assert.match(section, /youtube\.com/);
  assert.match(section, /youtu\.be/);
  assert.match(section, /parsed\.protocol !== "https:"/);
  assert.match(section, /UMdJ9zZ3fos/);
  assert.match(section, /if \(!videoId\) return null/);
  assert.doesNotMatch(section, /NEXT_PUBLIC_FLUXKNIGHT_BRAND_FILM_URL/);
});
test('YouTube iframe is deferred until play click and supports fullscreen', () => {
  const player = read('components/home/BrandFilmPlayer.tsx');
  assert.match(player, /www\.youtube-nocookie\.com\/embed/);
  assert.match(player, /hasStarted \?/);
  assert.match(player, /onClick=\{\(\) => setHasStarted\(true\)\}/);
  assert.match(player, /allowFullScreen/);
  assert.match(player, /Watch on YouTube/);
  assert.match(player, /\/fluxknight-mark\.svg/);
  assert.match(player, /Running on agentic systems/);
  assert.doesNotMatch(player, /ytimg\.com/);
  assert.doesNotMatch(player, /<video\b/);
});
