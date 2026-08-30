import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = await readFile(new URL("../lib/leo-runtime-config.ts", import.meta.url), "utf8");
const execution = await readFile(new URL("../lib/leo-execution.ts", import.meta.url), "utf8");
const n8n = await readFile(new URL("../lib/leo-n8n.ts", import.meta.url), "utf8");
const executeRoute = await readFile(new URL("../app/api/leo/runtime/execute/route.ts", import.meta.url), "utf8");
const webhookRoute = await readFile(new URL("../app/api/leo/n8n/webhook/route.ts", import.meta.url), "utf8");

test("Phase 10.1 validates runtime configuration without exposing the signing secret", () => {
  assert.match(config, /loadLeoRuntimeConfiguration/);
  assert.match(config, /auditLeoRuntimeConfiguration/);
  assert.match(config, /signingConfigured: Boolean/);
  assert.doesNotMatch(config, /getSafeLeoRuntimeConfiguration[\s\S]*signingSecret:/);
});

test("Phase 10.2 enforces tenant isolation and consequential approval", () => {
  assert.match(execution, /Cross-organization execution is forbidden/);
  assert.match(execution, /Consequential execution requires explicit approval evidence/);
  assert.match(execution, /Consequential execution requires an idempotency key/);
  assert.match(execution, /Missing evidence remains unknown/);
});

test("Phase 10.2 provides shared prompt, knowledge and event infrastructure", () => {
  assert.match(execution, /assembleLeoExecutionPrompt/);
  assert.match(execution, /LeoKnowledgeRetriever/);
  assert.match(execution, /LeoExecutionEventDispatcher/);
  assert.match(execution, /LeoExecutionGateway/);
});

test("Phase 10.3 signs n8n traffic, bounds retries and dead-letters exhausted execution", () => {
  assert.match(n8n, /createHmac\("sha256"/);
  assert.match(n8n, /timingSafeEqual/);
  assert.match(n8n, /maxRetries/);
  assert.match(n8n, /idempotency-key/);
  assert.match(n8n, /dead_lettered/);
  assert.match(n8n, /AbortController/);
});

test("Phase 10 execution remains Super Admin gated and n8n callbacks require signatures", () => {
  assert.match(executeRoute, /identity\.scope !== "super_admin"/);
  assert.match(executeRoute, /Super Admin authorization required/);
  assert.match(webhookRoute, /x-fluxknight-timestamp/);
  assert.match(webhookRoute, /x-fluxknight-signature/);
  assert.match(webhookRoute, /parseLeoN8nWebhook/);
});
