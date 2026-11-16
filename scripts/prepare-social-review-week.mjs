import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { getVideoMetadata } from "@remotion/renderer";
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
let output;
for (let attempt = 0; attempt < 180; attempt++) {
  const run = await runs.retrieve(handle.id);
  if (run.isCompleted) {
    assert.equal(run.status, "COMPLETED");
    assert.ok(!run.output?.skipped, "Weekly review is disabled or the organization is inactive");
    console.log(JSON.stringify({ triggerRunId: handle.id, output: run.output }));
    output = run.output;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert.ok(output, "Weekly review preparation timed out");
const variablesResponse = await fetch("https://api.trigger.dev/api/v1/projects/proj_ckweruqrgwndssqpjdvg/envvars", {
  headers: { Authorization: `Bearer ${environment.apiKey}` },
});
assert.ok(variablesResponse.ok, "Worker environment lookup failed");
const { variables } = await variablesResponse.json();
const serviceKey = variables.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_SECRET_KEY;
assert.ok(serviceKey, "Worker service credential is required");
const db = createClient("https://tacxegmlppngnuvldojy.supabase.co", serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const organizationId = "15046426-e520-438b-8694-7662a6986efb";
const brandId = "a330b65a-d5b2-45f3-b211-451616f2fa8d";
const date = new Date();
const weekday = date.getUTCDay();
const week = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday))).toISOString().slice(0, 10);
let posts;
const renderStatus = (post) => post.format === "reel" ? post.metadata.reel_render_status : post.metadata.carousel_render_status;
for (let attempt = 0; attempt < 180; attempt++) {
  const result = await db.from("social_posts").select("id,title,caption,format,content,metadata,status,approved_at,content_plan_id")
    .eq("organization_id", organizationId).eq("brand_id", brandId).eq("content->>week_start", week);
  assert.ifError(result.error);
  posts = result.data;
  assert.equal(posts.length, 7, "Expected exactly seven posts for the current week");
  if (posts.every((post) => renderStatus(post) === "ready")) break;
  const failed = posts.find((post) => ["failed", "queue_failed"].includes(renderStatus(post)));
  assert.ok(!failed, `Media render failed: ${failed?.id} ${failed?.metadata.reel_render_error || failed?.metadata.carousel_render_error || ""}`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert.ok(posts.every((post) => renderStatus(post) === "ready"), "Weekly media did not finish rendering");
assert.equal(new Set(posts.map((post) => post.content_plan_id)).size, 1);
const folder = "verification/social-review-week";
await mkdir(folder, { recursive: true });
const report = [];
for (const post of posts.sort((a, b) => a.content.planned_index - b.content.planned_index)) {
  assert.equal(post.status, "review");
  assert.equal(post.approved_at, null);
  if (post.format === "reel") {
    assert.equal(post.metadata.reel_audio_verified, true);
    assert.equal(post.metadata.reel_voice_review_status, "pending");
    const { data: asset, error } = await db.from("social_assets").select("bucket_id,storage_path,status,width,height,mime_type")
      .eq("organization_id", organizationId).eq("brand_id", brandId).eq("post_id", post.id).eq("id", post.metadata.reel_asset_id).single();
    assert.ifError(error);
    assert.equal(asset.status, "ready");
    assert.equal(asset.width, 1080);
    assert.equal(asset.height, 1920);
    const signed = await db.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 120);
    assert.ifError(signed.error);
    const downloaded = await fetch(signed.data.signedUrl);
    assert.ok(downloaded.ok);
    const filePath = `${folder}/${post.content.planned_index}.mp4`;
    await writeFile(filePath, Buffer.from(await downloaded.arrayBuffer()));
    const info = await getVideoMetadata(filePath);
    assert.ok(info.audioCodec && info.durationInSeconds > 0, "Video must contain a playable narration track");
    report.push({ id: post.id, title: post.title, caption: post.caption, cta: post.content.cta, format: post.format, slideCount: 0, audioVerified: true, status: post.status, approvedAt: post.approved_at });
    continue;
  }
  assert.equal(post.format, "carousel");
  const ids = post.metadata.carousel_asset_ids;
  assert.ok(Array.isArray(ids) && ids.length >= 5 && ids.length <= 8);
  assert.equal(new Set(ids).size, ids.length);
  const { data: assets, error } = await db.from("social_assets").select("id,bucket_id,storage_path,width,height,mime_type,status,metadata")
    .eq("organization_id", organizationId).eq("brand_id", brandId).eq("post_id", post.id).in("id", ids);
  assert.ifError(error);
  assert.equal(assets.length, ids.length);
  for (const [index, id] of ids.entries()) {
    const asset = assets.find((row) => row.id === id);
    assert.equal(asset.status, "ready");
    assert.equal(asset.width, 1080);
    assert.equal(asset.height, 1350);
    assert.equal(asset.metadata.position ?? asset.metadata.carousel_index, index + 1);
    const signed = await db.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 60);
    assert.ifError(signed.error);
    const downloaded = await fetch(signed.data.signedUrl);
    assert.ok(downloaded.ok);
    const png = Buffer.from(await downloaded.arrayBuffer());
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), 1350);
    await writeFile(`${folder}/${post.content.planned_index}-${index + 1}.png`, png);
  }
  report.push({ id: post.id, title: post.title, caption: post.caption, cta: post.content.cta, slideCount: ids.length, status: post.status, approvedAt: post.approved_at });
}
await writeFile(`${folder}/report.json`, JSON.stringify({ triggerRunId: handle.id, week, posts: report }, null, 2));
console.log(JSON.stringify({ triggerRunId: handle.id, week, postCount: report.length, videoCount: report.filter((post) => post.format === "reel").length, slideCount: report.reduce((sum, row) => sum + row.slideCount, 0), pngsVerified: true, publiclyPublished: false }));
