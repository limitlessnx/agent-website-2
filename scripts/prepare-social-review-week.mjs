import assert from "node:assert/strict";
import { configure, tasks, runs } from "@trigger.dev/sdk";
// No caller-supplied organization, post, approval, or publish inputs.
const response = await fetch("https://api.trigger.dev/api/v1/projects/proj_ckweruqrgwndssqpjdvg/prod", {
  headers: { Authorization: `Bearer ${process.env.TRIGGER_ACCESS_TOKEN}` },
});
assert.ok(response.ok, `Trigger environment lookup failed: ${response.status}`);
const environment = await response.json();
configure({ secretKey: environment.apiKey });
const handle = await tasks.trigger("flux-social-prepare-review-week", {});
console.log(JSON.stringify({ triggerRunId: handle.id }));
for (let attempt = 0; attempt < 180; attempt++) {
  const run = await runs.retrieve(handle.id);
  if (run.isCompleted) {
    assert.equal(run.status, "COMPLETED");
    assert.ok(!run.output?.skipped, "Weekly review is disabled or the organization is inactive");
    console.log(JSON.stringify({ triggerRunId: handle.id, output: run.output }));
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
throw new Error("Weekly review preparation timed out");
