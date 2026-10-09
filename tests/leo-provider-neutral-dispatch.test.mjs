import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dispatcher = readFileSync(resolve(root, "lib/leo-execution-dispatcher.ts"), "utf8");
const route = readFileSync(resolve(root, "app/api/leo/tool/route.ts"), "utf8");

test("Leo tool route dispatches through the provider-neutral boundary", () => {
  assert.match(route, /dispatchLeoExecution\(envelope\)/);
  assert.doesNotMatch(route, /executeLeoEnvelopeViaN8n/);
});

test("legacy adapter preserves the signed-envelope executor during migration", () => {
  assert.match(dispatcher, /id: "legacy_n8n"/);
  assert.match(dispatcher, /executeLeoEnvelopeViaN8n\(envelope\)/);
  assert.match(dispatcher, /interface LeoExecutionProvider/);
});

test("dispatcher rejects incomplete execution envelopes before provider dispatch", () => {
  assert.match(dispatcher, /Leo dispatch requires a request ID and canonical tool key/);
  assert.match(dispatcher, /A valid Leo execution provider is required/);
});

test("Trigger.dev is not selected implicitly before its adapter is implemented", () => {
  assert.match(dispatcher, /provider: LeoExecutionProvider = legacyN8nLeoProvider/);
  assert.match(dispatcher, /does not imply the migration is complete/);
});
