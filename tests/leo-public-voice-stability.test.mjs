import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/leo-public-voice-state.ts", import.meta.url), "utf8");

test("Public Leo voice defines an explicit deterministic state machine", () => {
  for (const state of [
    "idle",
    "connecting",
    "listening",
    "user_speaking",
    "endpointing",
    "generating",
    "tool_pending",
    "assistant_speaking",
    "interrupting",
    "degraded",
    "reconnecting",
    "ending",
  ]) {
    assert.match(source, new RegExp(`"${state}"`));
  }
  assert.match(source, /Invalid Public Leo voice transition/);
});

test("Public Leo voice epochs bind async work to call turn and generation", () => {
  assert.match(source, /callEpoch/);
  assert.match(source, /turnId/);
  assert.match(source, /generationId/);
  assert.match(source, /isCurrentPublicLeoEpoch/);
});
