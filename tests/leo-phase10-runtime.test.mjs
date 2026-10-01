import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = await readFile(new URL("../lib/leo-runtime-config.ts", import.meta.url), "utf8");
const execution = await readFile(new URL("../lib/leo-execution.ts", import.meta.url), "utf8");
const executeRoute = await readFile(new URL("../app/api/leo/runtime/execute/route.ts", import.meta.url), "utf8");

test("Phase 10.1 validates runtime configuration without legacy execution dependencies", () => {
  assert.match(config, /loadLeoRuntimeConfiguration/);
  assert.match(config, /auditLeoRuntimeConfiguration/);
  assert.doesNotMatch(config, /n8n/i);
  assert.doesNotMatch(config, /signingSecret/i);
});

test("Phase 10.2 enforces tenant isolation and consequential approval", () => {
  assert.match(execution, /Cross-organization execution is forbidden/);
  assert.match(execution, /Consequential execution requires explicit approval evidence/);
  assert.match(execution, /Consequential execution requires an idempotency key/);
  assert.match(execution, /Missing evidence remains unknown/);
});

test("Phase 10.3 keeps the canonical Leo runtime execution path available", () => {
  assert.match(executeRoute, /AgentRuntimeSDK/);
  assert.match(executeRoute, /createRuntimeToolRegistry/);
  assert.match(executeRoute, /Super Admin authorization required/);
  assert.doesNotMatch(executeRoute, /n8n/i);
  assert.doesNotMatch(execution, /n8n/i);
});

test("Phase 10.4 keeps execution bounded and auditable", () => {
  assert.match(execution, /AbortController|defaultTimeoutMs/);
  assert.match(execution, /maxRetries/);
  assert.match(execution, /idempotencyKey/);
});
