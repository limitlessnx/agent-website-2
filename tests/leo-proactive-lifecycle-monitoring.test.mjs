import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const lifecycleMonitor = await readFile(new URL("../lib/leo-lifecycle-proactive-monitor.ts", import.meta.url), "utf8");
const proactiveMonitor = await readFile(new URL("../lib/leo-proactive-monitor.ts", import.meta.url), "utf8");
const notifications = await readFile(new URL("../lib/dashboard-notifications.ts", import.meta.url), "utf8");
const monitorRoute = await readFile(new URL("../app/api/leo/monitor/route.ts", import.meta.url), "utf8");
const cronRoute = await readFile(new URL("../app/api/cron/leo-lifecycle-monitor/route.ts", import.meta.url), "utf8");
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

test("lifecycle monitoring uses unified lifecycle evidence and stable signal subtypes", () => {
  assert.match(lifecycleMonitor, /getUnifiedLifecycleSnapshots/);
  assert.match(lifecycleMonitor, /stableId\(\["lifecycle", rest\.workspace \|\| "", subtype\]\)/);
  assert.match(proactiveMonitor, /"lifecycle"/);
  assert.match(proactiveMonitor, /scanLifecycleProactiveSignals/);
});

test("lifecycle monitoring covers risk cancellation usage support integration and expansion", () => {
  for (const subtype of ["lifecycle_risk", "cancellation_intent", "usage_decline", "support_pressure", "integration_loss", "expansion_ready"]) {
    assert.match(lifecycleMonitor, new RegExp(subtype));
  }
});

test("risk state blocks expansion-ready signaling", () => {
  assert.match(lifecycleMonitor, /item\.stage === "expansion"/);
  assert.match(lifecycleMonitor, /item\.attention !== "high" && item\.attention !== "critical"/);
});

test("proactive lifecycle signals synchronize to admin dashboard notifications", () => {
  assert.match(notifications, /syncLeoProactiveLifecycleDashboardNotifications/);
  assert.match(notifications, /source: "leo_proactive"/);
  assert.match(notifications, /audience: "admin"/);
  assert.match(monitorRoute, /syncLeoProactiveLifecycleDashboardNotifications/);
});

test("notification transitions use stable keys and resolve stale risk and expansion alerts", () => {
  assert.match(notifications, /`lifecycle:\$\{item\.organizationId\}:risk`/);
  assert.doesNotMatch(notifications, /risk:\$\{item\.attention\}/);
  assert.match(notifications, /resolveDashboardNotification\(riskKey\)/);
  assert.match(notifications, /resolveDashboardNotification\(expansionKey\)/);
  assert.match(notifications, /signal\.lifecycle === "resolved"/);
});

test("scheduled cron is secret protected and observe-recommend only", () => {
  assert.match(cronRoute, /process\.env\.CRON_SECRET/);
  assert.match(cronRoute, /status: 401/);
  assert.match(cronRoute, /reconcileLeoProactiveSignals/);
  assert.match(cronRoute, /syncLeoProactiveLifecycleDashboardNotifications/);
  assert.match(cronRoute, /execution: "observe_recommend_only"/);
  assert.doesNotMatch(cronRoute, /createLeoOperationalTask|sendEmail|resend|executeTool/);
});

test("Vercel provides a daily lifecycle safety-net without feature-branch previews", () => {
  assert.equal(vercel.git.deploymentEnabled["feature/proactive-lifecycle-monitoring"], false);
  const cron = vercel.crons.find((item) => item.path === "/api/cron/leo-lifecycle-monitor");
  assert.ok(cron);
  assert.equal(cron.schedule, "17 6 * * *");
});
