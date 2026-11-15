import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

test("weekly planner receives the brand's industry strategy and preserves caption hashtags", async () => {
  const source = readFileSync(new URL("../lib/social-ai.ts", import.meta.url), "utf8");
  const exports = {};
  const requests = [];
  const caption = "Turn enquiries into a clear next step. #GymOwners #MembershipGrowth #Fluxknight";
  const plan = { strategy_summary: "Five industries", weekly_objective: "Qualified enquiries", audience_angle: "Business owners",
    posts: Array.from({ length: 5 }, (_, index) => ({ title: `Idea ${index}`, hook: "A concrete problem", caption,
      cta: "Book a demo", format: "text", platforms: ["linkedin"], content_pillar: "Sales", objective: "Enquiries", creative_brief: "A labelled workflow" })) };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, process: { env: { OPENAI_API_KEY: "test-only" } }, fetch: async (_, request) => {
      requests.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ output_text: JSON.stringify(plan) }) };
    } });
  const strategy = { industries: ["gyms", "hotels", "beauty and spas", "real estate", "service businesses"],
    offers: ["Voice call agents", "WhatsApp agents", "Email automations", "SMS automations"] };
  const brand = { name: "Fluxknight", metadata: { content_strategy: strategy } };
  const result = await exports.generateWeeklySocialPlan(brand);
  const context = JSON.parse(requests[0].input[1].content[0].text.split("\n").slice(1).join("\n"));
  assert.deepEqual(context.content_strategy, strategy);
  assert.equal(result.plan.posts[0].caption, caption);
  assert.match(requests[0].input[0].content[0].text, /not guaranteed results/);
  assert.match(requests[0].input[0].content[0].text, /End each caption with 3-6/);
  await exports.generateWeeklySocialPlan({ name: "Other brand", metadata: {} });
  assert.doesNotMatch(requests[1].input[1].content[0].text, /content_strategy/);
});
