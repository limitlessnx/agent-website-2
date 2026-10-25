import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourcePath = resolve(root, "lib/leo-action-approval.ts");
const migrationPath = resolve(root, "supabase/migrations/20261025210535_20261024141200_real_estate_action_approvals.sql");

function loadApprovalModule(request) {
  const require = createRequire(import.meta.url);
  const typescript = require("typescript");
  const compiledPath = resolve(tmpdir(), `leo-action-approval-${process.pid}-${randomUUID()}.cjs`);
  const compiled = typescript.transpileModule(readFileSync(sourcePath, "utf8"), {
    compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.CommonJS },
    fileName: sourcePath,
  }).outputText;
  writeFileSync(compiledPath, compiled);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(name, parent, isMain) {
    if (name === "@/lib/supabase-server-rest") return { supabaseServerRequest: request };
    return originalLoad.call(this, name, parent, isMain);
  };
  try {
    return require(compiledPath);
  } finally {
    Module._load = originalLoad;
    unlinkSync(compiledPath);
  }
}

function identity(overrides = {}) {
  return {
    scope: "super_admin",
    role: "super_admin",
    email: "admin@example.test",
    channel: "chat",
    globalScope: true,
    ...overrides,
  };
}

function createMockRequest() {
  const rows = new Map();
  const locks = new Map();
  const calls = [];
  const request = async (path, options) => {
    const payload = JSON.parse(options.body);
    calls.push({ path, payload });
    if (path.endsWith("create_real_estate_action_approval")) {
      rows.set(payload.p_approval_id, {
        id: payload.p_approval_id,
        organizationId: payload.p_organization_id,
        principalKind: payload.p_principal_kind,
        principalId: payload.p_principal_id,
        toolKey: payload.p_tool_key,
        argumentsDigest: payload.p_arguments_digest,
        sessionId: payload.p_session_id,
        channel: payload.p_channel,
        tokenDigest: payload.p_token_digest,
        expiresAt: Date.parse(payload.p_expires_at),
        status: "issued",
      });
      return [{ approval_id: payload.p_approval_id, status: "issued", expires_at: payload.p_expires_at }];
    }
    assert.ok(path.endsWith("consume_real_estate_action_approval"));
    const previous = locks.get(payload.p_approval_id) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    locks.set(payload.p_approval_id, previous.then(() => current));
    await previous;
    try {
      const row = rows.get(payload.p_approval_id);
      if (!row) return [{ approval_id: payload.p_approval_id, status: "rejected" }];
      const matches = row.organizationId === payload.p_organization_id
        && row.principalKind === payload.p_principal_kind
        && row.principalId === payload.p_principal_id
        && row.toolKey === payload.p_tool_key
        && row.argumentsDigest === payload.p_arguments_digest
        && row.sessionId === payload.p_session_id
        && row.channel === payload.p_channel
        && row.tokenDigest === payload.p_token_digest;
      if (!matches) return [{ approval_id: payload.p_approval_id, status: "rejected" }];
      if (row.status === "consumed") return [{ approval_id: payload.p_approval_id, status: "consumed" }];
      if (row.status === "expired" || row.expiresAt <= Date.now()) {
        row.status = "expired";
        return [{ approval_id: payload.p_approval_id, status: "expired" }];
      }
      row.status = "consumed";
      row.consumedAt = new Date().toISOString();
      return [{ approval_id: payload.p_approval_id, status: "accepted", consumed_at: row.consumedAt }];
    } finally {
      release();
      if (locks.get(payload.p_approval_id) === current) locks.delete(payload.p_approval_id);
    }
  };
  return { request, rows, calls };
}

function baseCreate(api, request, overrides = {}) {
  return api.createLeoActionApproval({
    identity: identity(),
    organizationId: "b15f21b4-5697-4d21-9421-8a34eae3476d",
    sessionId: "session-1",
    channel: "chat",
    toolKey: "leo.limitless.followup.send",
    arguments: { lead_id: "lead-1", message: "Approved update" },
    realEstateOptIn: true,
    request,
    ...overrides,
  });
}

function consumeInput(approval, api, request, overrides = {}) {
  return api.consumeLeoActionApproval({
    identity: identity(),
    organizationId: "b15f21b4-5697-4d21-9421-8a34eae3476d",
    sessionId: "session-1",
    channel: "chat",
    toolKey: approval.toolKey,
    arguments: { lead_id: "lead-1", message: "Approved update" },
    approvalId: approval.approvalId,
    token: approval.token,
    realEstateOptIn: true,
    request,
    ...overrides,
  });
}

test("real-estate approvals bind the authenticated principal, tenant, action, session and channel", async () => {
  const mock = createMockRequest();
  const api = loadApprovalModule(mock.request);
  const approval = await baseCreate(api, mock.request);
  assert.equal(approval.status, "issued");
  assert.match(approval.approvalId, /^[0-9a-f-]{36}$/);
  assert.ok(approval.token.length >= 40);
  assert.match(approval.argumentsDigest, /^[0-9a-f]{64}$/);
  assert.equal(
    api.leoApprovalArgumentsDigest("leo.limitless.followup.send", { message: "Approved update", lead_id: "lead-1" }),
    api.leoApprovalArgumentsDigest("leo.limitless.followup.send", { lead_id: "lead-1", message: "Approved update" }),
    "argument key ordering must not change the exact canonical digest",
  );

  const issuedPayload = mock.calls.find((call) => call.path.includes("create_real_estate"))?.payload;
  assert.ok(issuedPayload);
  assert.equal(issuedPayload.p_token, undefined, "raw token must never be persisted or sent to the RPC");
  assert.equal(issuedPayload.p_message, undefined, "messages must not be persisted");
  assert.match(issuedPayload.p_token_digest, /^[0-9a-f]{64}$/);

  assert.deepEqual(await consumeInput(approval, api, mock.request, { identity: identity({ email: "other@example.test" }) }), {
    accepted: false, status: "rejected", approvalId: approval.approvalId,
  });
  await assert.rejects(() => consumeInput(approval, api, mock.request, {
    identity: identity({ scope: "tenant", role: "member", userId: "tenant-user-1", organizationId: "b15f21b4-5697-4d21-9421-8a34eae3476d", globalScope: false }),
    organizationId: "7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4",
  }), /organization/i);
  assert.deepEqual(await consumeInput(approval, api, mock.request, { toolKey: "leo.limitless.campaign.send" }), {
    accepted: false, status: "rejected", approvalId: approval.approvalId,
  });
  assert.deepEqual(await consumeInput(approval, api, mock.request, { arguments: { lead_id: "lead-2", message: "Approved update" } }), {
    accepted: false, status: "rejected", approvalId: approval.approvalId,
  });
  assert.deepEqual(await consumeInput(approval, api, mock.request, { sessionId: "session-2" }), {
    accepted: false, status: "rejected", approvalId: approval.approvalId,
  });
  await assert.rejects(() => consumeInput(approval, api, mock.request, { channel: "voice" }), /channel/i);
});

test("super-admin email fallback is server-derived, and real-estate opt-in is mandatory", async () => {
  const mock = createMockRequest();
  const api = loadApprovalModule(mock.request);
  const approval = await baseCreate(api, mock.request, {
    identity: identity({ userId: undefined, email: "  Admin@Example.Test " }),
  });
  const issuedPayload = mock.calls.find((call) => call.path.includes("create_real_estate"))?.payload;
  assert.equal(issuedPayload.p_principal_kind, "super_admin_email");
  assert.equal(issuedPayload.p_principal_id, "admin@example.test");
  await assert.rejects(() => baseCreate(api, mock.request, { realEstateOptIn: false }), /opt-in/i);
  await assert.rejects(() => baseCreate(api, mock.request, { toolKey: "xposure.send" }), /Limitless Realty/i);
  assert.deepEqual(await consumeInput(approval, api, mock.request, {
    identity: identity({ email: "different@example.test" }),
  }), { accepted: false, status: "rejected", approvalId: approval.approvalId });
});

test("expiry, replay, and concurrent consumption fail closed", async () => {
  const mock = createMockRequest();
  const api = loadApprovalModule(mock.request);
  const expired = await baseCreate(api, mock.request, { expiresInMs: 1 });
  await new Promise((resolve) => setTimeout(resolve, 8));
  assert.deepEqual(await consumeInput(expired, api, mock.request), {
    accepted: false, status: "expired", approvalId: expired.approvalId,
  });

  const replayable = await baseCreate(api, mock.request);
  const [first, second] = await Promise.all([
    consumeInput(replayable, api, mock.request),
    consumeInput(replayable, api, mock.request),
  ]);
  assert.equal([first, second].filter((result) => result.accepted).length, 1);
  assert.equal([first, second].filter((result) => result.status === "consumed").length, 1);
  assert.deepEqual(await consumeInput(replayable, api, mock.request), {
    accepted: false, status: "consumed", approvalId: replayable.approvalId,
  });
});

test("migration and module preserve the no-bypass, service-role-only boundary", () => {
  const moduleSource = readFileSync(sourcePath, "utf8");
  const migration = readFileSync(migrationPath, "utf8");
  assert.doesNotMatch(moduleSource, /confirmed/);
  assert.match(moduleSource, /approvalId/);
  assert.match(moduleSource, /token/);
  assert.match(migration, /alter table public\.real_estate_action_approvals enable row level security/i);
  assert.match(migration, /revoke all on public\.real_estate_action_approvals from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.consume_real_estate_action_approval[\s\S]*to service_role/i);
  assert.match(migration, /for update/);
  assert.match(migration, /status = 'consumed'/);
  assert.doesNotMatch(migration, /message|secret/i);
});
