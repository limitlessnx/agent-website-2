import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const route = readFileSync(resolve(root, "app/api/support/leo/route.ts"), "utf8");
const actionRoute = readFileSync(resolve(root, "app/api/support/leo/actions/[id]/route.ts"), "utf8");
const model = readFileSync(resolve(root, "lib/ai/support-model.ts"), "utf8");
const sanitizer = readFileSync(resolve(root, "lib/ai/support-sanitizer.ts"), "utf8");
const policy = readFileSync(resolve(root, "lib/leo-support-policy.ts"), "utf8");

test("tenant conversation lookup is scoped to the authenticated organization", () => {
  assert.match(route, /getSupportConversationForScope\(conversationId,\s*"tenant",\s*session\.organizationId\)/);
  assert.match(route, /organization_id=eq\.\$\{encodeURIComponent\(session\.organizationId\)\}/);
});

test("unauthenticated tenant requests return 401", () => {
  assert.match(route, /if \(!session\) return NextResponse\.json\(\{ error: "Authentication required\." \}, \{ status: 401 \}\)/);
});

test("unsupported AI action keys are rejected", () => {
  assert.match(model, /SUPPORT_ACTION_KEYS\.includes\(item\.actionKey as SupportActionKey\)/);
  assert.match(route, /allowedActionKeys\.has\(action\.actionKey\)/);
});

test("legacy support actions must pass Leo Core v2 role policy", () => {
  assert.match(route, /legacySupportActionPolicy\(input\.identity, action\.actionKey\)/);
  assert.match(route, /legacySupportActionPolicy\(leoIdentity, action\.action_key\)/);
  assert.match(policy, /isLeoToolAllowed\(identity, canonicalKey\)/);
});

test("tenant action approval is independently role checked", () => {
  assert.match(actionRoute, /legacySupportActionPolicy\(leoIdentity, action\.action_key\)/);
  assert.match(actionRoute, /status: 403/);
  assert.match(actionRoute, /current tenant role is not permitted/i);
});

test("provider and validation failures trigger the rule based fallback", () => {
  assert.match(model, /reason: "provider_error"/);
  assert.match(model, /reason: "invalid_response"/);
  assert.match(route, /if \(aiResult\.ok\)[\s\S]*else \{[\s\S]*buildSupportReply\(/);
});

test("diagnostics are sanitized before reaching the model", () => {
  assert.match(model, /sanitizeSupportDiagnostics\(/);
  assert.match(sanitizer, /\[redacted-url\]/);
  assert.match(sanitizer, /service\[_ -\]\?role/);
  assert.doesNotMatch(sanitizer, /provider_customer_id|provider_subscription_id|metadata:\s*item\.metadata|credential_reference|webhook_secret/);
});

test("AI replies are stored with safe metadata", () => {
  assert.match(route, /role: "assistant",[\s\S]*content: replyText,[\s\S]*diagnostics: \{ safe: safeDiagnostics, ai: aiMetadata \}/);
});

test("approval mode comes from canonical Leo policy instead of model risk labels alone", () => {
  assert.match(route, /status: "proposed"/);
  assert.match(route, /approval_required: policy\.approval !== "none"/);
  assert.match(route, /approval_mode: policy\.approval/);
});

test("usage tracking is best effort and cannot fail the support reply", () => {
  assert.match(route, /usage_type: "ai_support"/);
  assert.match(route, /\}\)\.catch\(\(\) => null\)/);
});
