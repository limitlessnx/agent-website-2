import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { configure, tasks, runs } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";

const project = "proj_ckweruqrgwndssqpjdvg";
const organizationId = "15046426-e520-438b-8694-7662a6986efb";
const postId = "f498c6f6-c467-4af1-9303-21366c269ccb";
async function api(path, token) {
  const response = await fetch(`https://api.trigger.dev${path}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.ok(response.ok, `Trigger API HTTP ${response.status}`);
  return response.json();
}
const env = await api(`/api/v1/projects/${project}/prod`, process.env.TRIGGER_ACCESS_TOKEN);
const { variables: vars } = await api(`/api/v1/projects/${project}/envvars`, env.apiKey);
const key = vars.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || vars.SUPABASE_SERVICE_ROLE_KEY || vars.SUPABASE_SECRET_KEY;
assert.ok(key);
const db = createClient("https://tacxegmlppngnuvldojy.supabase.co", key, { auth: { persistSession: false, autoRefreshToken: false } });
async function readPost(initial = false) {
  const { data, error } = await db.from("social_posts").select("id,status,approved_at,metadata")
    .eq("organization_id", organizationId).eq("id", postId).single();
  assert.ifError(error);
  if (initial) assert.ok(["approved", "review"].includes(data.status));
  else { assert.equal(data.status, "review"); assert.equal(data.approved_at, null); }
  return data;
}
const before = await readPost(true);
const { data: queued, error: queueError } = await db.from("social_posts").update({
  status: "review", approved_at: null, metadata: { ...before.metadata, reel_render_status: "queued",
    reel_audio_verified: false, reel_voice_review_status: "pending", reel_render_error: null },
}).eq("organization_id", organizationId).eq("id", postId).eq("status", before.status).select("id").maybeSingle();
assert.ifError(queueError); assert.ok(queued);
configure({ secretKey: env.apiKey });
const handle = await tasks.trigger("flux-social-render-reel", { organizationId, postId, reuseNarration: false },
  { idempotencyKey: "legacy-lead-reel-audio-repair-v1", maxAttempts: 1 });
console.log(JSON.stringify({ runId: handle.id, postId }));
let completed;
for (let index = 0; index < 210; index++) {
  const run = await runs.retrieve(handle.id);
  if (run.isCompleted) { assert.equal(run.status, "COMPLETED", `Repair run ended ${run.status}`); completed = run; break; }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert.ok(completed, "Repair did not complete within the verification window");
const after = await readPost();
assert.equal(after.metadata.reel_narration_asset_ids.length, before.metadata.reel_plan.scenes.length);
assert.equal(after.metadata.reel_voice_review_status, "pending");
assert.equal(after.metadata.reel_render_status, "ready");
assert.equal(after.metadata.reel_audio_verified, true);
const { data: asset, error } = await db.from("social_assets")
  .select("id,bucket_id,storage_path,mime_type,width,height,duration_ms")
  .eq("organization_id", organizationId).eq("post_id", postId).eq("id", after.metadata.reel_asset_id).single();
assert.ifError(error); assert.equal(asset.mime_type, "video/mp4");
assert.equal(asset.width, 1080); assert.equal(asset.height, 1920);
const { data: signed, error: signedError } = await db.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 120);
assert.ifError(signedError);
const response = await fetch(signed.signedUrl); assert.ok(response.ok);
const bytes = Buffer.from(await response.arrayBuffer());
assert.ok(bytes.length > 20000); assert.equal(bytes.subarray(4, 8).toString(), "ftyp");
const { count, error: publishError } = await db.from("social_publish_jobs").select("id", { count: "exact", head: true })
  .eq("organization_id", organizationId).eq("post_id", postId);
assert.ifError(publishError); assert.equal(count, 0);
const result = { runId: handle.id, postId, assetId: asset.id, width: asset.width, height: asset.height,
  durationMs: asset.duration_ms, bytes: bytes.length, narrationGenerated: true, status: after.status,
  approvedAt: after.approved_at, voiceReview: after.metadata.reel_voice_review_status, publishJobs: count };
await mkdir("/tmp/corrected-legacy-reel", { recursive: true });
await writeFile("/tmp/corrected-legacy-reel/preview.mp4", bytes);
await writeFile("/tmp/corrected-legacy-reel/verification.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
