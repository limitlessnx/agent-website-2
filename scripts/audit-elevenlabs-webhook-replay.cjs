/* eslint-disable @typescript-eslint/no-require-imports */
// Local synthetic diagnostic. Exit 1 means the known replay defect reproduced;
// this is not a passing regression test or a live provider integration check.
const path = require("node:path");
const assert = require("node:assert/strict");
const load = require("../tests/helpers/load-typescript.cjs");
const root = path.resolve(__dirname, "..");
const helpers = load(path.join(root, "lib/elevenlabs-webhooks.ts"));
let inserts = 0;
let processingAttempts = 0;
let processingError = null;
let billingCalls = 0;

const admin = {
  from(table) {
    let operation = "read";
    let patch;
    return {
      insert() { operation = "insert"; return this; },
      update(value) { operation = "update"; patch = value; return this; },
      select() { return this; },
      eq() { return this; },
      maybeSingle() { return this; },
      then(resolve, reject) {
        let result;
        if (table === "elevenlabs_voice_webhook_events") {
          if (operation === "insert") result = { error: inserts++ ? { code: "23505" } : null };
          else { processingError = patch.processing_error; result = { error: null }; }
        } else if (table === "agents") {
          processingAttempts++;
          result = { data: null, error: { message: "Synthetic database interruption" } };
        } else throw new Error(`Unexpected diagnostic table: ${table}`);
        return Promise.resolve(result).then(resolve, reject);
      },
    };
  },
};
const rejectBilling = async () => { billingCalls++; throw new Error("Billing is forbidden in this diagnostic"); };
const route = load(path.join(root, "app/api/webhooks/elevenlabs/post-call/route.ts"), {
  "next/server": { NextResponse: { json: (body, { status = 200 } = {}) => ({ body, status }) } },
  "@/lib/supabase/admin": { createAdminClient: () => admin },
  "@/lib/flux-ai-metering-core": { preflightChargeableFluxAi: rejectBilling, recordChargeableFluxAiUsage: rejectBilling },
  "@/lib/elevenlabs-webhooks": { ...helpers, verifyElevenLabsSignature: () => true },
}, "", { process: { env: { ELEVENLABS_WEBHOOK_SECRET: "synthetic-only" } } });

const payload = JSON.stringify({
  event_id: "synthetic-replay", type: "post_call_transcription",
  data: { conversation_id: "synthetic-call", agent_id: "synthetic-provider-agent", metadata: { organization_id: "synthetic-org" } },
});
const request = () => ({ text: async () => payload, headers: { get: () => "synthetic authentication boundary" } });

async function main() {
  const first = await route.POST(request());
  const retry = await route.POST(request());
  assert.equal(first.status, 500, "The diagnostic must first create a processing failure");
  assert.equal(billingCalls, 0, "No billing/provider action may run");
  assert.ok(processingError, "The failed attempt must leave failure evidence");
  const reproduced = retry.status === 200 && retry.body.duplicate === true && processingAttempts === 1;
  console.log(JSON.stringify({
    finding: "failed_webhook_replay_acknowledged_without_processing", reproduced,
    firstStatus: first.status, retryStatus: retry.status,
    processingAttempts, billingCalls,
    authentication: "mocked; signature verification is outside this replay-only diagnostic",
  }));
  process.exitCode = reproduced ? 1 : 0;
}
main().catch(error => { console.error(error); process.exitCode = 2; });
