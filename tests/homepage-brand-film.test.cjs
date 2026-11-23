const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('home page positions optional film immediately after existing hero', () => {
  const homepage = read('app/page.tsx');
  assert.match(homepage, /<ProductLedHero\s*\/>\s*<BrandFilmSection\s*\/>\s*<AutomationJourney\s*\/>/);
  assert.match(homepage, /<IndustryExplorer\s*\/>/);
  assert.match(homepage, /<MeetLeoSection\s*\/>/);
});
test('film remains hidden until a secure public media URL is provided', () => {
  const section = read('components/home/BrandFilmSection.tsx');
  assert.match(section, /NEXT_PUBLIC_FLUXKNIGHT_BRAND_FILM_URL/);
  assert.match(section, /parsed\.protocol === "https:"/);
  assert.match(section, /if \(!src\) return null/);
});
test('video loads only when requested and supports accessible playback', () => {
  const player = read('components/home/BrandFilmPlayer.tsx');
  assert.match(player, /preload="none"/);
  assert.match(player, /playsInline/);
  assert.doesNotMatch(player, /autoPlay/);
  assert.match(player, /video\.play\(\)/);
  assert.match(player, /kind="captions"/);
  assert.match(player, /role="alert"/);
});
