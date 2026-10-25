const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const LIMITLESS_ORG = "b15f21b4-5697-4d21-9421-8a34eae3476d";

function loadCompiled(sourcePath, mocks, globals = {}) {
  const compiledPath = path.join(os.tmpdir(), `leo-security-${process.pid}-${Math.random().toString(16).slice(2)}.cjs`);
  fs.writeFileSync(compiledPath, ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: sourcePath,
  }).outputText);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(name, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    return originalLoad.call(this, name, parent, isMain);
  };
  try {
    const context = { ...globals };
    return require(compiledPath);
  } finally {
    Module._load = originalLoad;
    fs.rmSync(compiledPath, { force: true });
  }
}

function response(payload, status = 200) {
  return { payload, status, async json() { return this.payload; } };
}

function adminOrganizationMock() {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: { id: LIMITLESS_ORG, slug: "limitless-realty", status: "active" }, error: null }),
      };
    },
  };
}

function identity() {
  return { scope: "super_admin", role: "super_admin", email: "admin@example.test", channel: "chat", globalScope: true };
}

function routeMocks(state, toolKey) {
  const tool = { key: toolKey, title: toolKey, readOnly: false, approval: "confirm" };
  const approvalApi = {
    LIMITLESS_REALTY_ORGANIZATION_ID: LIMITLESS_ORG,
    LIMITLESS_REALTY_SLUG: "limitless-realty",
    isLimitlessOrganizationId: (value) => value === LIMITLESS_ORG,
    isRealEstateApprovalTool: (value) => ["leo.limitless.campaign.send", "leo.crm.leads.update"].includes(value),
    async createLeoActionApproval(input) {
      state.created.push(input);
      return { approvalId: "approval-1", token: "token-1", toolKey: input.toolKey, argumentsDigest: "a".repeat(64), expiresAt: new Date(Date.now() + 300000).toISOString(), status: "issued" };
    },
    async consumeLeoActionApproval(input) {
      state.consumed.push(input);
      const same = input.approvalId === "approval-1" && input.token === "token-1" && input.arguments.lead_id === "lead-1";
      if (state.consumedOnce || !same || input.arguments.message === "changed") return { accepted: false, status: state.consumedOnce ? "consumed" : "rejected", approvalId: input.approvalId };
      state.consumedOnce = true;
      return { accepted: true, status: "accepted", approvalId: input.approvalId };
    },
  };
  return {
    "next/server": { NextRequest: class {}, NextResponse: { json: (payload, init = {}) => response(payload, init.status || 200) } },
    "@/lib/leo-core": {
      resolveLeoIdentity: async () => state.identity||identity(),
      assertLeoToolAllowed: () => tool,
      leoApprovalFor: () => "confirm",
    },
    "@/lib/leo-execution-envelope": {
      createLeoExecutionEnvelope: (input) => { state.envelopes.push(input); return { ...input, version: 2, issuedAt: Date.now(), expiresAt: Date.now() + 120000, channel: "chat", identity: identity(), signature: "signed" }; },
    },
    "@/lib/leo-n8n-executor": { executeLeoEnvelopeViaN8n: async (envelope) => { state.forwarded.push(envelope); return { ok: true, status: "completed", requestId: envelope.requestId }; } },
    "@/lib/leo-session-store": { auditLeoEvent: async (event) => state.audits.push(event), getOrCreateLeoSession: async () => null, updateLeoPublicLeadState: async () => null, updateLeoVoiceWorkingContext: async () => undefined },
    "@/lib/leo-lead-capture": { capturePublicLeoLead: async () => ({ ok: true }) },
    "@/lib/supabase/admin": { createAdminClient: adminOrganizationMock },
    "@/lib/leo-limitless-messaging": {
      ensureLimitlessExecutionId: () => "execution-1",
      findLimitlessLeads: async () => ({ ok: true }), prepareLimitlessCampaign: async () => ({ ok: true }), prepareLimitlessFollowup: async () => ({ ok: true }), saveLimitlessLead: async () => ({ ok: true }), sendLimitlessFollowup: async (_request, args) => { state.sent.push(args); return { ok: true, status: "sent" }; }, sendThroughLimitlessCampaignRoute: async (_request, args) => { state.sent.push(args); return { ok: true, status: "sent" }; },
    },
    "@/lib/orchestration-operations": { inspectOrchestrationChain: async () => ({}), retryFailedSystemEvent: async () => ({}) },
    "@/lib/leo-action-approval": approvalApi,
    "@/lib/real-estate-organization": {resolveActiveRealEstateOrganization:async(_client,id)=>id==="b15f21b4-5697-4d21-9421-8a34eae3476d"?{id,slug:"limitless-realty",status:"active"}:id==="fixture-realty-org"?{id,slug:"fixture-realty",status:"active"}:null},
  };
}

async function postRoute(route, body) {
  return route.POST({ json: async () => body, headers: { get: () => null } });
}

function baseBody(toolKey, argumentsValue = { lead_id: "lead-1", message: "approved" }) {
  return { channel: "chat", toolKey, sessionId: "session-1", arguments: argumentsValue, confirmed: true };
}

test("public direct Limitless send issues server approval and ignores confirmed boolean", async () => {
  const state = { created: [], consumed: [], consumedOnce: false, sent: [], forwarded: [], envelopes: [], audits: [] };
  const route = loadCompiled(path.join(root, "app/api/leo/tool/route.ts"), routeMocks(state, "leo.limitless.campaign.send"));
  const first = await postRoute(route, baseBody("leo.limitless.campaign.send"));
  assert.equal(first.status, 409);
  assert.equal(first.payload.status, "confirmation_required");
  assert.equal(state.created.length, 1);
  assert.equal(state.sent.length, 0);
  assert.equal(first.payload.approvalId, "approval-1");
  assert.equal(first.payload.token, "token-1");
});

test("direct Limitless send consumes once, binds exact args, and rejects replay or changed args", async () => {
  const state = { created: [], consumed: [], consumedOnce: false, sent: [], forwarded: [], envelopes: [], audits: [] };
  const route = loadCompiled(path.join(root, "app/api/leo/tool/route.ts"), routeMocks(state, "leo.limitless.campaign.send"));
  await postRoute(route, baseBody("leo.limitless.campaign.send"));
  const confirmed = { ...baseBody("leo.limitless.campaign.send"), approvalId: "approval-1", approvalToken: "token-1" };
  const executed = await postRoute(route, confirmed);
  assert.equal(executed.status, 200);
  assert.equal(state.consumed.length, 1);
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0].request_id, "approval-1");

  const replay = await postRoute(route, confirmed);
  assert.equal(replay.status, 409);
  assert.equal(state.sent.length, 1);

  const changed = await postRoute(route, { ...confirmed, arguments: { lead_id: "lead-1", message: "changed" } });
  assert.equal(changed.status, 409);
  assert.equal(state.sent.length, 1);
});

test("generic Limitless mutation forwards signed approval metadata and does not consume at public route", async () => {
  const state = { created: [], consumed: [], consumedOnce: false, sent: [], forwarded: [], envelopes: [], audits: [] };
  const route = loadCompiled(path.join(root, "app/api/leo/tool/route.ts"), routeMocks(state, "leo.crm.leads.update"));
  const targetArgs = { organization_id: LIMITLESS_ORG, workspace: "limitless_realty", lead_id: "lead-1", message: "approved" };
  await postRoute(route, baseBody("leo.crm.leads.update", targetArgs));
  const executed = await postRoute(route, { ...baseBody("leo.crm.leads.update", targetArgs), approvalId: "approval-1", approvalToken: "token-1" });
  assert.equal(executed.status, 200);
  assert.equal(state.consumed.length, 0);
  assert.equal(state.envelopes.length, 1);
  assert.equal(state.envelopes[0].approvalGranted, true);
  assert.deepEqual(state.envelopes[0].arguments._real_estate_approval, { approvalId: "approval-1", token: "token-1" });
  assert.equal(state.envelopes[0].requestId, "approval-1");
});

function internalMocks(state, envelope) {
  return {
    "next/server": { NextRequest: class {}, NextResponse: { json: (payload, init = {}) => response(payload, init.status || 200) } },
    "@/lib/runtime/auth": { secureEqual: (a, b) => a === b },
    "@/lib/leo-execution-envelope": { verifyLeoExecutionEnvelope: (body) => ({ envelope:body.envelope||envelope, identity:state.identity||identity() }) },
    "@/lib/leo-tool-runtime": { executeAuthorizedLeoTool: async (input) => { state.executed.push(input); return { ok: true }; } },
    "@/lib/leo-core": { leoApprovalFor: () => "confirm",assertLeoToolAllowed:()=>({readOnly:false,key:envelope.toolKey}) },
    "@/lib/leo-session-store": { auditLeoEvent: async (event) => state.audits.push(event) },
    "@/lib/real-estate-organization": {resolveActiveRealEstateOrganization:async(_client,id)=>id==="b15f21b4-5697-4d21-9421-8a34eae3476d"?{id,slug:"limitless-realty",status:"active"}:id==="fixture-realty-org"?{id,slug:"fixture-realty",status:"active"}:null},
    "@/lib/leo-action-approval": {
      LIMITLESS_REALTY_ORGANIZATION_ID: LIMITLESS_ORG,
      isLimitlessOrganizationId: (value) => value === LIMITLESS_ORG,
      isRealEstateApprovalTool: (value) => value === "leo.crm.leads.update",
      consumeLeoActionApproval: async (input) => { state.consumed.push(input); return state.accept ? { accepted: true, status: "accepted", approvalId: input.approvalId } : { accepted: false, status: "consumed", approvalId: input.approvalId }; },
    },
    "@/lib/supabase/admin": { createAdminClient: adminOrganizationMock },
  };
}

function internalRequest(body) {
  return { json: async () => body, headers: { get: (name) => name === "x-fluxknight-leo-secret" ? "bridge-secret" : null } };
}

test("internal route consumes signed approval atomically, strips metadata, and rejects replay or approvalGranted-only bypass", async () => {
  process.env.LEO_N8N_SHARED_SECRET = "bridge-secret";
  const state = { accept: true, consumed: [], executed: [], audits: [] };
  const envelope = { requestId: "approval-1", sessionId: "session-1", channel: "chat", toolKey: "leo.crm.leads.update", approvalGranted: true, arguments: { organization_id: LIMITLESS_ORG, workspace: "limitless_realty", lead_id: "lead-1", message: "approved", _real_estate_approval: { approvalId: "approval-1", token: "token-1" } } };
  const route = loadCompiled(path.join(root, "app/api/internal/leo/execute/route.ts"), internalMocks(state, envelope));
  const first = await route.POST(internalRequest({ envelope, identity: identity() }));
  assert.equal(first.status, 200);
  assert.equal(state.consumed.length, 1);
  assert.equal(state.executed[0].arguments._real_estate_approval, undefined);

  state.accept = false;
  const replay = await route.POST(internalRequest({ envelope, identity: identity() }));
  assert.equal(replay.status, 409);
  assert.equal(state.executed.length, 1);

  state.accept = true;
  const bypassEnvelope = { ...envelope, arguments: { organization_id: LIMITLESS_ORG, workspace: "limitless_realty", lead_id: "lead-1", message: "approved" } };
  const bypass = await route.POST(internalRequest({ envelope: bypassEnvelope, identity: identity() }));
  assert.equal(bypass.status, 409);
  assert.equal(state.executed.length, 1);
  assert.ok(state.audits.some((event) => event.eventType === "tool_execution_failed" && event.details.request_id === "approval-1"));
});

test("internal execution also rejects confirmed-only mutations for a second real-estate tenant",async()=>{
 process.env.LEO_N8N_SHARED_SECRET="bridge-secret";
 const state={identity:{scope:"tenant",role:"manager",userId:"tenant-user",organizationId:"fixture-realty-org",organizationSlug:"fixture-realty",membershipId:"membership-1",permissions:["customers.manage"],channel:"chat",globalScope:false},accept:false,consumed:[],executed:[],audits:[]};
 const envelope={requestId:"fixture-request-1",sessionId:"session-1",channel:"chat",toolKey:"leo.crm.leads.update",approvalGranted:true,arguments:{organization_id:"fixture-realty-org",lead_id:"lead-1",stage:"qualified"}};
 const route=loadCompiled(path.join(root,"app/api/internal/leo/execute/route.ts"),internalMocks(state,envelope));const result=await route.POST(internalRequest({envelope}));assert.equal(result.status,409);assert.equal(state.executed.length,0);assert.equal(state.consumed.length,0);
});

test("Limitless message sending requires preparedToken and refuses non-Limitless admin scope", async () => {
  const messaging = loadCompiled(path.join(root, "lib/leo-limitless-messaging.ts"), {
    "@/lib/admin-organization-scope": { resolveAdminOrganizationScope: async () => ({ kind: "system", systemId: "limitless-realty", organizationId: LIMITLESS_ORG, slug: "limitless-realty" }) },
    "@/lib/lead-profile-service": { getCampaignAudienceLeads: async () => [{ id: "lead-1", name: "A", phone: "123", status: "new", campaign_eligible: true }], normalizeLeadPhone: (value) => value, saveProgressiveLead: async () => [] },
    "@/lib/limitless-data": { getProperties: async () => [] },
    "@/lib/property-campaign-message": { buildPropertyCampaignContent: () => ({ message: "approved", propertyName: "Property" }) },
    "@/lib/whatsapp-status-log": { getMetaCooldownPhones: async () => new Set() },
    "@/lib/leo-limitless-diagnostics": { diagnoseLimitlessCampaign: async () => ({}) },
    "@/lib/leo-action-approval": { LIMITLESS_REALTY_ORGANIZATION_ID: LIMITLESS_ORG, LIMITLESS_REALTY_SLUG: "limitless-realty" },
  });
  await assert.rejects(() => messaging.sendThroughLimitlessCampaignRoute({ url: "https://test.invalid", headers: { get: () => "" } }, { organization_id: LIMITLESS_ORG, message: "approved" }, "lead-1"), /preparedToken/i);
});
