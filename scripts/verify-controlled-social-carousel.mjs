import assert from "node:assert/strict";
import { configure, tasks, runs } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";

// Deliberately no arbitrary task, tenant, or post inputs; never approve or publish.
const project = "proj_ckweruqrgwndssqpjdvg";
const organizationId = "15046426-e520-438b-8694-7662a6986efb";
const postId = "3678a6f5-e803-4750-9e2e-d24f80a4fdf5";
async function api(path, token) {
  const response = await fetch(`https://api.trigger.dev${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.ok(response.ok, `Trigger API request failed: HTTP ${response.status}`);
  return response.json();
}
const environment = await api(`/api/v1/projects/${project}/prod`, process.env.TRIGGER_ACCESS_TOKEN);
const { variables } = await api(`/api/v1/projects/${project}/envvars`, environment.apiKey);
let url = variables.LIMITLESS_SUPABASE_URL || variables.SUPABASE_URL || variables.NEXT_PUBLIC_SUPABASE_URL
  || "https://tacxegmlppngnuvldojy.supabase.co";
// Match getServerSupabaseConfig's existing retired-project normalization.
if (new URL(url).hostname === "fwhwsvetndbjaljzghpg.supabase.co") {
  url = "https://tacxegmlppngnuvldojy.supabase.co";
}
assert.equal(new URL(url).hostname, "tacxegmlppngnuvldojy.supabase.co");
const serviceKey = variables.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_SECRET_KEY;
assert.ok(serviceKey, "Worker requires its existing Supabase service credential");
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function readPost() {
  const { data, error } = await db.from("social_posts")
    .select("id,status,approved_at,metadata").eq("id", postId)
    .eq("organization_id", organizationId).single();
  assert.ifError(error);
  assert.equal(data.status, "review", "Controlled post must still be in Review");
  assert.equal(data.approved_at, null, "Controlled post must remain unapproved");
  return data;
}
await readPost();
configure({ secretKey: environment.apiKey });
const handle = await tasks.trigger("flux-social-render-carousel", { organizationId, postId }, {
  idempotencyKey: "pr399-controlled-review-carousel-v1",
});
console.log(JSON.stringify({ triggerRunId: handle.id, postId }));
let completed;
for (let attempt = 0; attempt < 90; attempt += 1) {
  const run = await runs.retrieve(handle.id);
  if (run.isCompleted) {
    assert.equal(run.status, "COMPLETED", `Controlled run ended with ${run.status}`);
    completed = run;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert.ok(completed, "Controlled run did not complete within verification window");
const post = await readPost();
assert.equal(post.metadata.carousel_render_status, "ready");
const ids = post.metadata.carousel_asset_ids;
assert.ok(Array.isArray(ids) && ids.length >= 5 && ids.length <= 8);
assert.equal(new Set(ids).size, ids.length);
const { data: assets, error } = await db.from("social_assets")
  .select("id,status,mime_type,bucket_id,storage_path,width,height,metadata")
  .eq("organization_id", organizationId).eq("post_id", postId).in("id", ids);
assert.ifError(error);
assert.equal(assets.length, ids.length);
for (const [index, id] of ids.entries()) {
  const asset = assets.find((row) => row.id === id);
  assert.equal(asset.status, "ready");
  assert.equal(asset.mime_type, "image/png");
  assert.equal(asset.metadata.position, index + 1);
  assert.equal(asset.metadata.carousel_index, index + 1);
  assert.equal(asset.width, 1080);
  assert.equal(asset.height, 1350);
  const { data, error } = await db.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 60);
  assert.ifError(error);
  const response = await fetch(data.signedUrl);
  assert.ok(response.ok, `Slide ${index + 1} signed URL failed`);
  const png = Buffer.from(await response.arrayBuffer());
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1350);
}
console.log(JSON.stringify({ triggerRunId: handle.id, status: completed.status,
  slideCount: ids.length, orderedAssetIds: ids, signedPngsVerified: true,
  postStatus: post.status, approvedAt: post.approved_at, publiclyPublished: false }));
