import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { configure, tasks, runs } from "@trigger.dev/sdk";

// Explicit user authorization: this one approved post, this one Instagram account.
const organizationId = "15046426-e520-438b-8694-7662a6986efb";
const postId = "3678a6f5-e803-4750-9e2e-d24f80a4fdf5";
const project = "proj_ckweruqrgwndssqpjdvg";
async function triggerApi(path, key) {
  const response = await fetch(`https://api.trigger.dev${path}`, { headers: { Authorization: `Bearer ${key}` } });
  assert.ok(response.ok, `Trigger API HTTP ${response.status}`); return response.json();
}
const env = await triggerApi(`/api/v1/projects/${project}/prod`, process.env.TRIGGER_ACCESS_TOKEN);
const { variables: vars } = await triggerApi(`/api/v1/projects/${project}/envvars`, env.apiKey);
const serviceKey = vars.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || vars.SUPABASE_SERVICE_ROLE_KEY || vars.SUPABASE_SECRET_KEY;
assert.ok(serviceKey);
const db = createClient("https://tacxegmlppngnuvldojy.supabase.co", serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function platformRef() {
  const { data, error } = await db.from("social_post_platform_refs").select("external_post_id,published_url")
    .eq("organization_id", organizationId).eq("post_id", postId).eq("platform", "instagram").maybeSingle();
  assert.ifError(error); return data;
}
const existing = await platformRef();
if (existing) { console.log(JSON.stringify({ alreadyPublished: true, ...existing })); process.exit(0); }
const { data: post, error: postError } = await db.from("social_posts").select("id,brand_id,title,status,approved_at,caption,platforms,metadata")
  .eq("organization_id", organizationId).eq("id", postId).single();
assert.ifError(postError); assert.equal(post.status, "approved"); assert.ok(post.approved_at);
assert.equal(post.metadata.carousel_render_status, "ready");
const ids = post.metadata.carousel_asset_ids;
assert.equal(ids.length, 7); assert.equal(new Set(ids).size, 7);
const { data: assets, error: assetError } = await db.from("social_assets")
  .select("id,status,mime_type,bucket_id,storage_path,metadata")
  .eq("organization_id", organizationId).eq("brand_id", post.brand_id).eq("post_id", postId).in("id", ids);
assert.ifError(assetError); assert.equal(assets.length, 7);
for (const [index, id] of ids.entries()) {
  const asset = assets.find((row) => row.id === id);
  assert.equal(asset.status, "ready"); assert.equal(asset.mime_type, "image/png");
  assert.equal(asset.metadata.position, index + 1);
  const { data, error } = await db.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 300);
  assert.ifError(error); const response = await fetch(data.signedUrl); assert.ok(response.ok);
  const png = Buffer.from(await response.arrayBuffer()); assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
}
const { data: integration, error: integrationError } = await db.from("organization_integrations").select("status,configuration")
  .eq("organization_id", organizationId).eq("provider", "meta").single();
assert.ifError(integrationError); assert.equal(integration.status, "connected");
const { data: credentials, error: credentialError } = await db.rpc("get_organization_integration_credentials", {
  p_organization_id: organizationId, p_provider: "meta",
});
assert.ifError(credentialError);
const config = integration.configuration;
const instagramId = credentials.instagram_login_user_id || config.instagram_login_user_id || config.instagram_business_account_id;
const token = credentials.instagram_user_access_token || credentials.access_token;
const graphHost = credentials.instagram_user_access_token ? "graph.instagram.com" : "graph.facebook.com";
const version = config.api_version || "v24.0";
const profileResponse = await fetch(`https://${graphHost}/${version}/${instagramId}?fields=id,username`, {
  headers: { Authorization: `Bearer ${token}` },
});
assert.ok(profileResponse.ok, `Instagram profile verification HTTP ${profileResponse.status}`);
const profile = await profileResponse.json(); assert.equal(profile.username, "fluxknight.space");
console.log(JSON.stringify({ preflight: "passed", postId, instagramUsername: profile.username, slides: 7 }));
const caption = post.caption.replace(/\\+r\\+n|\\+n|\\+r/g, "\n").trim()
  + "\n\n#CRM #LeadFollowUp #SalesAutomation #WhatsAppAutomation #Fluxknight";
assert.ok(caption.length <= 2200);
// No other platform is added to the schedule, even if present on the source post.
const { data: scheduledPost, error: updateError } = await db.from("social_posts").update({
  status: "scheduled", caption, platforms: [...new Set([...post.platforms, "instagram"])],
}).eq("organization_id", organizationId).eq("id", postId).eq("status", "approved")
  .eq("approved_at", post.approved_at).select("id").maybeSingle();
assert.ifError(updateError); assert.ok(scheduledPost, "Post changed since approval; publication stopped");
const { data: schedule, error: scheduleError } = await db.from("social_schedules").insert({
  organization_id: organizationId, post_id: postId, scheduled_for: new Date().toISOString(), timezone: "UTC", status: "pending",
  metadata: { publish_platforms: ["instagram"], authorization: "explicit-user-selected-first-crm-carousel", publisher: "meta-graph-api" },
}).select("id").single();
assert.ifError(scheduleError);
configure({ secretKey: env.apiKey });
const handle = await tasks.trigger("flux-social-publish-post", { scheduleId: schedule.id },
  { idempotencyKey: "first-authorized-crm-instagram-v1", maxAttempts: 1 });
console.log(JSON.stringify({ runId: handle.id, scheduleId: schedule.id, postId }));
let completed;
for (let index = 0; index < 150; index++) {
  const run = await runs.retrieve(handle.id);
  if (run.isCompleted) { assert.equal(run.status, "COMPLETED", `Publishing run ended ${run.status}; inspect platform references before retrying`); completed = run; break; }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert.ok(completed, "Publishing run still pending; inspect before retrying");
const ref = await platformRef(); assert.ok(ref?.external_post_id); assert.ok(ref.published_url);
const verifyResponse = await fetch(`https://${graphHost}/${version}/${ref.external_post_id}?fields=id,permalink,media_type,children{id},caption`, {
  headers: { Authorization: `Bearer ${token}` },
});
assert.ok(verifyResponse.ok, `Published media verification HTTP ${verifyResponse.status}`);
const media = await verifyResponse.json(); assert.equal(media.media_type, "CAROUSEL_ALBUM"); assert.equal(media.children?.data?.length, 7);
assert.equal(media.caption, caption);
console.log(JSON.stringify({ published: true, postId, instagramUsername: profile.username,
  instagramMediaId: media.id, permalink: media.permalink, slideCount: media.children.data.length, runId: handle.id }));
