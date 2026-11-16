import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: (id) => overrides[id] || require(id), Buffer, Date, URL, process: { env: {} } });
  return exports;
}
const music = load("lib/social-music-upload.ts");
test("music upload accepts files above the web payload limit while validating size and permission", () => {
  music.validateMusicInput({ size: 10 * 1024 * 1024, mimeType: "audio/mpeg", licensed: true });
  assert.throws(() => music.validateMusicInput({ size: 21 * 1024 * 1024, mimeType: "audio/mpeg", licensed: true }), /20 MB/);
  assert.throws(() => music.validateMusicInput({ size: 100, mimeType: "audio/mpeg", licensed: false }), /permission/);
  assert.throws(() => music.validateMusicInput({ size: 100, mimeType: "image/png", licensed: true }), /MP3/);
});
test("upload receipt binds the organization, brand, destination and default choice", () => {
  const { receipt, ticket } = music.createMusicTicket({ organizationId: "org-a", brandId: "brand-a", fileName: "track.mp3", mimeType: "audio/mpeg", size: 4096, makeDefault: true }, "test-key");
  assert.equal(music.verifyMusicTicket(receipt, "test-key", "org-a").path, ticket.path);
  assert.equal(music.verifyMusicTicket(receipt, "test-key", "org-a").makeDefault, true);
  assert.throws(() => music.verifyMusicTicket(receipt, "test-key", "org-b"), /another workspace/);
  assert.throws(() => music.verifyMusicTicket(receipt + "x", "test-key", "org-a"), /invalid/);
  assert.throws(() => music.verifyMusicTicket(receipt, "other-key", "org-a"), /invalid/);
});
test("audio header checks reject an image pretending to be music", () => {
  assert.equal(music.isAudioSignature(Buffer.from("ID3audio"), "audio/mpeg"), true);
  assert.equal(music.isAudioSignature(Buffer.from("RIFF0000WAVE"), "audio/wav"), true);
  assert.equal(music.isAudioSignature(Buffer.from("0000ftypM4A"), "audio/mp4"), true);
  assert.equal(music.isAudioSignature(Buffer.from("not an audio file"), "audio/mpeg"), false);
});
test("upload preparation returns a private destination without sending file bytes through the route", async () => {
  let authenticated = 0;
  let destination;
  const db = { from() { return { select() { return this; }, eq() { return this; }, async single() { return { data: { id: "brand-a" }, error: null }; } }; },
    storage: { from() { return { async createSignedUploadUrl(path) { destination = path; return { data: { signedUrl: "https://example.invalid/private-upload" }, error: null }; } }; } } };
  const route = load("app/api/social/music-upload/route.ts", {
    "@/lib/tenant": { requireTenant: async () => { authenticated++; return { supabase: db, organizationId: "org-a" }; } },
    "@/lib/supabase-server-rest": { getServerSupabaseConfig: () => ({ key: "test-only" }) },
    "@/lib/social-assets": { SOCIAL_ASSET_BUCKET: "private" }, "@/lib/social-music-upload": music,
  });
  const rejected = await route.POST(new Request("https://example.test/api/social/music-upload", { method: "POST", headers: { origin: "https://other.test" } }));
  assert.equal(rejected.status, 403); assert.equal(authenticated, 0);
  const response = await route.POST(new Request("https://example.test/api/social/music-upload", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" },
    body: JSON.stringify({ phase: "prepare", size: 10 * 1024 * 1024, mimeType: "audio/mpeg", licensed: true, makeDefault: true, brandId: "brand-a", fileName: "music.mp3" }) }));
  assert.equal(response.status, 200); assert.equal(authenticated, 1);
  const result = await response.json(); assert.equal(result.uploadUrl, "https://example.invalid/private-upload");
  assert.ok(destination.startsWith("org-a/music/"));
  assert.equal(music.verifyMusicTicket(result.receipt, "test-only", "org-a").brandId, "brand-a");
});
test("brand default is used only after a per-post override and stays tenant scoped", async () => {
  const audio = load("lib/social-reel-audio.ts");
  const queries = [];
  const db = { from(table) {
    const query = { table, filters: [] }; queries.push(query);
    const builder = { select() { return this; }, eq(k,v) { query.filters.push([k,v]); return this; }, async single() {
      return { error: null, data: table === "social_brands" ? { metadata: { default_reel_music_asset_id: "default-track" } }
        : { id: "chosen-track", status: "ready", asset_type: "audio", mime_type: "audio/mpeg", bucket_id: "private", storage_path: "audio.mp3", metadata: { licensed_for_social_usage: true } } };
    } }; return builder;
  }, storage: { from() { return { async createSignedUrl() { return { error: null, data: { signedUrl: "https://example.invalid/audio" } }; } }; } } };
  await audio.getLicensedReelMusic(db, "org-a", "brand-a");
  assert.deepEqual(queries[0].filters, [["organization_id", "org-a"], ["id", "brand-a"]]);
  assert.ok(queries[1].filters.some(([k,v]) => k === "id" && v === "default-track"));
  queries.length = 0;
  await audio.getLicensedReelMusic(db, "org-a", "brand-a", "override-track");
  assert.equal(queries[0].table, "social_assets");
  assert.ok(queries[0].filters.some(([k,v]) => k === "id" && v === "override-track"));
  assert.ok(queries[0].filters.some(([k,v]) => k === "brand_id" && v === "brand-a"));
});
