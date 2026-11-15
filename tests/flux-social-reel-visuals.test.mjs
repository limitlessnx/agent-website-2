import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import vm from "node:vm";
const source = readFileSync(new URL("../src/remotion/reel-visual-model.ts", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
const { normalizeReelText, getReelVisual } = exports;
const plan = JSON.parse(readFileSync(new URL("./fixtures/flux-social-support-reel.json", import.meta.url)));
test("legacy single and multiply escaped newlines become real line breaks", () => {
  assert.equal(normalizeReelText("Hello\\nworld"), "Hello\nworld");
  assert.equal(normalizeReelText("Hello\\\\nworld"), "Hello\nworld");
  for (const scene of plan.scenes) assert.doesNotMatch(normalizeReelText(scene.on_screen_text), /\\/);
});
test("all seven recorded scenes resolve to actual illustrations", () => {
  assert.deepEqual(plan.scenes.map((scene) => getReelVisual(scene).kind),
    ["inbox", "inbox", "question_router", "answer", "capture", "handoff", "overview"]);
});
test("unsupported production instructions fail before generating an empty preview", () => {
  assert.throws(() => getReelVisual({ visual_direction: "Show an unavailable screenshot" }), /structured visual data/);
});
test("structured visual labels are normalized and director prose is not rendered", () => {
  assert.equal(getReelVisual({ visual: { kind: "pipeline", title: "Clear\\nsteps", items: ["Capture", "Assign"] } }).title, "Clear\nsteps");
  const reel = readFileSync(new URL("../src/remotion/FluxSocialReel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(reel, /\{scene\.visual_direction\}/);
  assert.match(reel, /<ReelIllustration/);
});
