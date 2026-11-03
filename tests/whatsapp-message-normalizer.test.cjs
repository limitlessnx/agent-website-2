const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const load = require("./helpers/load-typescript.cjs");

const normalizer = load(path.resolve(__dirname, "../lib/whatsapp-message-normalizer.ts"), {});

test("template parameters become single-line provider-safe text", () => {
  assert.equal(
    normalizer.normalizeTemplateParameter("🔥 IWINOSA\nMEGA CITY\t25% OFF    TODAY"),
    "🔥 IWINOSA MEGA CITY 25% OFF TODAY",
  );
});

test("template parameters preserve meaningful Unicode and currency", () => {
  assert.equal(
    normalizer.normalizeTemplateParameter("50 × 100 ft | ₦1,000,000 only"),
    "50 × 100 ft | ₦1,000,000 only",
  );
});

test("template parameters reject empty and oversized values rather than truncating", () => {
  assert.throws(() => normalizer.normalizeTemplateParameter("  \n  "), /cannot be empty/);
  assert.throws(() => normalizer.normalizeTemplateParameter("12345", { maxLength: 4 }), /too long/);
});

test("template variables are normalized by configured key order", () => {
  assert.deepEqual(
    normalizer.normalizeTemplateVariables(["name", "offer"], { name: "Ada\n", offer: "₦1m\t only" }),
    { name: "Ada", offer: "₦1m only" },
  );
});

test("direct-session messages retain intentional paragraphs", () => {
  assert.equal(
    normalizer.normalizeDirectMessage("Hello\r\n\r\nPlease see details.\tThanks."),
    "Hello\n\nPlease see details. Thanks.",
  );
});

test("direct-session messages reject empty and oversized content", () => {
  assert.throws(() => normalizer.normalizeDirectMessage("  \n "), /required/);
  assert.throws(() => normalizer.normalizeDirectMessage("12345", 4), /too long/);
});
