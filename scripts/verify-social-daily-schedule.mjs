import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { configure, tasks, runs, schedules } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import { metaPublisherConfigFromIntegration } from "../lib/social-meta-publisher.ts";

const project = "proj_ckweruqrgwndssqpjdvg";
const organizationId = "15046426-e520-438b-8694-7662a6986efb";
const brandId = "a330b65a-d5b2-45f3-b211-451616f2fa8d";
const planId = "b3a4a2d9-3fcd-40a1-993e-049c745ef181";
async function api(path, token) {
  const response = await fetch(`https://api.trigger.dev${path}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.ok(response.ok, `Trigger API lookup failed: ${response.status}`);
  return response.json();
}
const environment = await api(`/api/v1/projects/${project}/prod`, process.env.TRIGGER_ACCESS_TOKEN);
const { variables } = await api(`/api/v1/projects/${project}/envvars`, environment.apiKey);
const key = variables.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_SECRET_KEY;
assert.ok(key);
const db = createClient("https://tacxegmlppngnuvldojy.supabase.co", key, { auth: { persistSession: false, autoRefreshToken: false } });
const before = await db.from("social_publish_jobs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
assert.ifError(before.error);
// A read-only account check verifies the existing connection without publishing.
const meta = await metaPublisherConfigFromIntegration(db, organizationId);
const account = new URL(`https://${meta.instagramGraphHost || "graph.facebook.com"}/${meta.apiVersion}/${meta.instagramBusinessAccountId}`);
account.searchParams.set("fields", "id,username");
account.searchParams.set("access_token", meta.instagramAccessToken || meta.accessToken);
const connectedResponse = await fetch(account);
assert.ok(connectedResponse.ok, `Instagram connection check failed: ${connectedResponse.status}`);
const connected = await connectedResponse.json();
assert.equal(connected.username, "fluxknight.space");
configure({ secretKey: environment.apiKey });
const registered = await schedules.list({ perPage: 100 });
const sweep = registered.data.find((item) => item.task === "flux-social-daily-publishing-sweep");
assert.ok(sweep?.active, "The automatic publishing sweep must be active in Trigger.dev");
assert.equal(sweep.generator.expression, "*/5 * * * *");
assert.equal(sweep.timezone, "Africa/Lagos");
assert.ok(sweep.environments.some((item) => item.type === "PRODUCTION"), "The sweep must be attached to production");
const clockSchedule = { id: sweep.id, active: sweep.active, cron: sweep.generator.expression, timezone: sweep.timezone, window: sweep.window, nextRun: sweep.nextRun };
console.log(JSON.stringify({ clockSchedule }));
// This mode can assign future times but cannot invoke the publisher.
const handle = await tasks.trigger("flux-social-daily-publishing-cycle", { scheduleOnly: true });
console.log(JSON.stringify({ triggerRunId: handle.id, mode: "schedule_only" }));
let output;
for (let attempt = 0; attempt < 60; attempt++) {
  const run = await runs.retrieve(handle.id);
  if (run.isCompleted) { assert.equal(run.status, "COMPLETED");output = run.output;break; }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert.ok(output && !output.skipped);
assert.equal(output.dispatched, false);
const { data: posts, error: postError } = await db.from("social_posts").select("id,title,status,approved_at,content,metadata")
  .eq("organization_id", organizationId).eq("brand_id", brandId).eq("content_plan_id", planId);
assert.ifError(postError);
assert.equal(posts.length, 7);
const { data: slots, error } = await db.from("social_schedules").select("id,post_id,scheduled_for,timezone,status,metadata")
  .eq("organization_id", organizationId).in("post_id", posts.map((post) => post.id)).order("scheduled_for");
assert.ifError(error);
assert.equal(slots.length, 7);
assert.equal(new Set(slots.map((slot) => slot.scheduled_for.slice(0, 10))).size, 7);
for (const slot of slots) {
  assert.equal(slot.status, "pending");
  assert.ok(Date.parse(slot.scheduled_for) > Date.now(), "Verification must run before any configured publication time");
  assert.equal(new Date(slot.scheduled_for).toISOString().slice(11, 16), "17:00");
  assert.equal(slot.timezone, "Africa/Lagos");
  assert.equal(slot.metadata.source, "fluxknight-daily-instagram-v1");
  assert.deepEqual(slot.metadata.publish_platforms, ["instagram"]);
  const post = posts.find((post) => post.id === slot.post_id);
  assert.equal(post.status, "scheduled");
  assert.ok(post.approved_at);
  assert.equal(Date.parse(slot.metadata.approval_snapshot), Date.parse(post.approved_at));
}
const after = await db.from("social_publish_jobs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
assert.ifError(after.error);
assert.equal(after.count, before.count, "Scheduling verification must not create publishing jobs");
const result = { triggerRunId: handle.id, clockSchedule, instagramAccount: connected.username, dailyTime: "18:00 Africa/Lagos / 17:00 UTC", scheduledPosts: slots.map((slot) => ({ scheduleId: slot.id, postId: slot.post_id, title: posts.find((post) => post.id === slot.post_id).title, scheduledFor: slot.scheduled_for })), publishJobCount: after.count, publiclyPublishedDuringVerification: false };
await mkdir("verification", { recursive: true });
await writeFile("verification/social-daily-schedule.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
