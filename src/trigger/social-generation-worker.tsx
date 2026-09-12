import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { logger, schedules, task } from "@trigger.dev/sdk";
import { fluxSocialRenderReel } from "./social-reel-renderer";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";
const SOCIAL_ASSET_BUCKET = "flux-social-assets";
const WIDTH = 1080;
const HEIGHT = 1350;

type GenerationJob = {
  id: string;
  organization_id: string;
  weekly_run_id: string;
  post_id: string;
  job_type: "none" | "static" | "carousel" | "reel_plan" | "reel_render";
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  attempt_count: number;
  metadata: Record<string, unknown>;
};

type PostRow = {
  id: string;
  organization_id: string;
  brand_id: string;
  title: string;
  caption: string;
  format: string;
  status: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type BrandRow = {
  id: string;
  organization_id: string;
  name: string;
  audience: string;
  tone: string;
  products: string[];
};

type ReelPlan = {
  title: string;
  objective: string;
  target_duration_seconds: number;
  hook: string;
  scenes: Array<{
    order: number;
    duration_seconds: number;
    scene_type: "hook" | "ui_demo" | "problem" | "workflow" | "benefit" | "cta";
    voiceover: string;
    on_screen_text: string;
    visual_direction: string;
    source_media: "fluxknight_ui" | "screenshot" | "motion_graphics" | "uploaded_media";
  }>;
  cta: string;
};

type GraphicInput = {
  kind: "static" | "carousel";
  logoUrl: string;
  pillar: string;
  headline: string;
  body?: string;
  footer?: string;
  slideType?: string;
  index?: number;
  total?: number;
};

const CAROUSEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "slides"],
  properties: {
    title: { type: "string" },
    slides: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "headline", "body"],
        properties: {
          type: { type: "string", enum: ["hook", "problem", "insight", "example", "solution", "cta"] },
          headline: { type: "string" },
          body: { type: "string" },
        },
      },
    },
  },
} as const;

const REEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "objective", "target_duration_seconds", "hook", "scenes", "cta"],
  properties: {
    title: { type: "string" },
    objective: { type: "string" },
    target_duration_seconds: { type: "number", minimum: 15, maximum: 90 },
    hook: { type: "string" },
    cta: { type: "string" },
    scenes: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["order", "duration_seconds", "scene_type", "voiceover", "on_screen_text", "visual_direction", "source_media"],
        properties: {
          order: { type: "integer", minimum: 1 },
          duration_seconds: { type: "number", minimum: 1, maximum: 20 },
          scene_type: { type: "string", enum: ["hook", "ui_demo", "problem", "workflow", "benefit", "cta"] },
          voiceover: { type: "string" },
          on_screen_text: { type: "string" },
          visual_direction: { type: "string" },
          source_media: { type: "string", enum: ["fluxknight_ui", "screenshot", "motion_graphics", "uploaded_media"] },
        },
      },
    },
  },
} as const;

function createSocialAdminClient() {
  const url = process.env.LIMITLESS_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ACTIVE_SUPABASE_URL;
  const key = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Flux Social generation worker requires a Supabase service-role key in Trigger.dev.");
  return createClient(url.replace(/\/$/, ""), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const body = payload as { output_text?: unknown; output?: unknown };
  if (typeof body.output_text === "string") return body.output_text;
  if (!Array.isArray(body.output)) return "";
  for (const item of body.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) return text;
    }
  }
  return "";
}

async function structuredOpenAI(name: string, schema: object, system: string, user: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for Flux Social generation.");
  const model = process.env.OPENAI_SOCIAL_MODEL || "gpt-5.6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`OpenAI ${name} failed: HTTP ${response.status}`);
  const raw = extractResponseText(payload);
  if (!raw) throw new Error(`OpenAI returned no ${name} payload.`);
  return { parsed: JSON.parse(raw) as Record<string, unknown>, model };
}

async function getCanonicalLogoDataUrl(supabase: SupabaseClient, organizationId: string, brandId: string) {
  const { data: registry, error: registryError } = await supabase
    .from("social_brand_assets")
    .select("social_asset_id")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .eq("asset_role", "logo_primary")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (registryError) throw registryError;
  if (!registry?.social_asset_id) throw new Error("A canonical Fluxknight primary logo must be registered before automated media generation.");

  const { data: asset, error: assetError } = await supabase
    .from("social_assets")
    .select("bucket_id,storage_path,mime_type")
    .eq("organization_id", organizationId)
    .eq("id", registry.social_asset_id)
    .single();
  if (assetError) throw assetError;

  const { data: signed, error: signedError } = await supabase.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 3600);
  if (signedError) throw signedError;

  const logoResponse = await fetch(signed.signedUrl);
  if (!logoResponse.ok) throw new Error(`Failed to load canonical Fluxknight logo: HTTP ${logoResponse.status}`);

  const logoBytes = Buffer.from(await logoResponse.arrayBuffer());
  return `data:${asset.mime_type ?? "image/png"};base64,${logoBytes.toString("base64")}`;
}

async function renderGraphic(input: GraphicInput) {
  logger.info("Flux Social graphic bundle started", { kind: input.kind, index: input.index, total: input.total });
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.tsx"),
    onProgress: (progress) => console.log(`Flux Social graphic bundle ${Math.round(progress * 100)}%`),
  });
  logger.info("Flux Social graphic bundle completed", { kind: input.kind, index: input.index, total: input.total });
  logger.info("Flux Social graphic composition select started", { kind: input.kind, index: input.index, total: input.total });
  const composition = await selectComposition({
    serveUrl,
    id: "FluxSocialGraphic",
    inputProps: input,
    timeoutInMilliseconds: 60_000,
    chromiumOptions: {
      disableWebSecurity: true,
      enableMultiProcessOnLinux: false,
      ignoreCertificateErrors: true,
    },
  });
  logger.info("Flux Social graphic composition select completed", { kind: input.kind, index: input.index, total: input.total });
  const output = path.join(tmpdir(), `flux-social-graphic-${crypto.randomUUID()}.png`);
  try {
    logger.info("Flux Social graphic still render started", { kind: input.kind, index: input.index, total: input.total });
    await renderStill({
      composition,
      serveUrl,
      output,
      inputProps: input,
      imageFormat: "png",
      logLevel: "warn",
      timeoutInMilliseconds: 60_000,
      chromiumOptions: {
        disableWebSecurity: true,
        enableMultiProcessOnLinux: false,
        ignoreCertificateErrors: true,
      },
    });
    const bytes = new Uint8Array(await readFile(output));
    logger.info("Flux Social graphic still render completed", { kind: input.kind, index: input.index, total: input.total, bytes: bytes.byteLength });
    return bytes;
  } finally {
    await rm(output, { force: true }).catch(() => undefined);
  }
}

async function uploadAsset(supabase: SupabaseClient, input: {
  organizationId: string;
  brandId: string;
  postId: string;
  assetType: "image" | "carousel_slide";
  bytes: Uint8Array;
  fileName: string;
  metadata: Record<string, unknown>;
}) {
  const storagePath = `${input.organizationId}/${input.postId}/${crypto.randomUUID()}-${input.fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(SOCIAL_ASSET_BUCKET)
    .upload(storagePath, input.bytes, { contentType: "image/png", cacheControl: "31536000", upsert: false });
  if (uploadError) throw uploadError;

  const { data: asset, error: assetError } = await supabase
    .from("social_assets")
    .insert({
      organization_id: input.organizationId,
      post_id: input.postId,
      brand_id: input.brandId,
      asset_type: input.assetType,
      source: "system",
      status: "ready",
      bucket_id: SOCIAL_ASSET_BUCKET,
      storage_path: storagePath,
      mime_type: "image/png",
      size_bytes: input.bytes.byteLength,
      width: WIDTH,
      height: HEIGHT,
      metadata: input.metadata,
    })
    .select("id")
    .single();
  if (assetError) {
    await supabase.storage.from(SOCIAL_ASSET_BUCKET).remove([storagePath]);
    throw assetError;
  }
  return asset.id as string;
}

function appendUniqueAssetIds(existing: unknown, next: string[]) {
  return [...new Set([...(Array.isArray(existing) ? existing : []), ...next].filter((id): id is string => typeof id === "string"))];
}

function reviewStatusAfterMedia(post: PostRow) {
  return ["draft", "failed"].includes(post.status) ? "review" : post.status;
}

async function markPostMediaReady(supabase: SupabaseClient, post: PostRow, metadata: Record<string, unknown>) {
  const nextStatus = reviewStatusAfterMedia(post);
  const patch: Record<string, unknown> = {
    status: nextStatus,
    metadata: {
      ...post.metadata,
      ...metadata,
      generation_status: "ready",
      generation_error: null,
    },
  };
  if (["draft", "failed", "review"].includes(post.status)) patch.approved_at = null;

  const { error } = await supabase
    .from("social_posts")
    .update(patch)
    .eq("organization_id", post.organization_id)
    .eq("id", post.id);
  if (error) throw error;
}

async function markPostMediaFailed(supabase: SupabaseClient, post: PostRow, message: string) {
  const { error } = await supabase
    .from("social_posts")
    .update({
      status: "draft",
      approved_at: null,
      metadata: {
        ...(post.metadata || {}),
        generation_status: "failed",
        generation_error: message,
        generation_failed_at: new Date().toISOString(),
      },
    })
    .eq("organization_id", post.organization_id)
    .eq("id", post.id);
  if (error) throw error;
}

async function processStatic(supabase: SupabaseClient, post: PostRow, logoUrl: string) {
  const content = post.content || {};
  const bytes = await renderGraphic({
    kind: "static",
    logoUrl,
    headline: String(content.hook || post.title || "Build a smarter operating system."),
    pillar: String(content.content_pillar || "Business automation"),
    footer: String(content.objective || post.caption || "Smarter operations with Fluxknight."),
  });
  const assetId = await uploadAsset(supabase, {
    organizationId: post.organization_id,
    brandId: post.brand_id,
    postId: post.id,
    assetType: "image",
    bytes,
    fileName: `fluxknight-static-${post.id}.png`,
    metadata: { renderer: "remotion-still-4.0.523", template: "fluxknight-social-static-v3", brand_asset_policy: "canonical-logo-only", storage_policy: "supabase-only" },
  });
  await markPostMediaReady(supabase, post, {
    media_assets: appendUniqueAssetIds(post.metadata?.media_assets, [assetId]),
    primary_asset_id: assetId,
    static_graphic_template: "fluxknight-social-static-v3",
  });
  return { assetIds: [assetId] };
}

async function processCarousel(supabase: SupabaseClient, brand: BrandRow, post: PostRow, logoUrl: string) {
  const content = post.content || {};
  const { parsed, model } = await structuredOpenAI(
    "flux_social_carousel_worker",
    CAROUSEL_SCHEMA,
    "You are Fluxknight's carousel editor. Create 5-8 concise slides from the supplied post. Use a sharp operational hook, concrete business mechanisms and a natural CTA. Avoid generic AI language. Illustrative scenarios are allowed, but never present invented figures as verified customer results.",
    `Build a Fluxknight carousel from: ${JSON.stringify({ audience: brand.audience, post: { title: post.title, caption: post.caption, content } })}`,
  );
  const slides = parsed.slides as Array<{ type: string; headline: string; body: string }>;
  if (!Array.isArray(slides) || slides.length < 5 || slides.length > 8) throw new Error("Carousel worker requires 5-8 slides.");

  const assetIds: string[] = [];
  for (let i = 0; i < slides.length; i += 1) {
    const bytes = await renderGraphic({
      kind: "carousel",
      logoUrl,
      pillar: String(content.content_pillar || "Business automation"),
      headline: slides[i].headline,
      body: slides[i].body,
      slideType: slides[i].type,
      index: i + 1,
      total: slides.length,
    });
    const assetId = await uploadAsset(supabase, {
      organizationId: post.organization_id,
      brandId: post.brand_id,
      postId: post.id,
      assetType: "carousel_slide",
      bytes,
      fileName: `fluxknight-carousel-${post.id}-${i + 1}.png`,
      metadata: { renderer: "remotion-still-4.0.523", template: "fluxknight-social-carousel-v3", carousel_index: i + 1, carousel_total: slides.length, slide_type: slides[i].type, model, brand_asset_policy: "canonical-logo-only", storage_policy: "supabase-only" },
    });
    assetIds.push(assetId);
  }

  await markPostMediaReady(supabase, post, {
    media_assets: appendUniqueAssetIds(post.metadata?.media_assets, assetIds),
    carousel_asset_ids: assetIds,
    primary_asset_id: assetIds[0] || null,
    carousel_plan: parsed,
    carousel_template: "fluxknight-social-carousel-v3",
    carousel_generated_at: new Date().toISOString(),
  });
  return { assetIds };
}

async function processReel(supabase: SupabaseClient, brand: BrandRow, post: PostRow) {
  const { parsed, model } = await structuredOpenAI(
    "flux_social_reel_worker",
    REEL_SCHEMA,
    [
      "You are Fluxknight Social's short-form video director.",
      "Create a product-demo or educational Reel using Fluxknight UI footage, screenshots, uploaded business media, motion graphics, captions and optional voiceover.",
      "Do not propose premium/cinematic AI-generated footage, AI avatars or external generative-video providers; Phase 3.5 uses deterministic Remotion composition, product UI/screenshots, uploaded media and motion graphics.",
      "Aspirational and simulated product visuals are allowed when they represent a capability, target state, scenario or demonstration Fluxknight can actually deliver.",
      "Do not present invented figures as verified customer history.",
      "The first two seconds must earn attention with a specific operational problem or sharp observation.",
    ].join(" "),
    `Build a Fluxknight Reel storyboard from: ${JSON.stringify({ brand, post: { title: post.title, caption: post.caption, content: post.content } })}`,
  );
  const plan = parsed as unknown as ReelPlan;
  const { error: planError } = await supabase.from("social_posts").update({ metadata: { ...post.metadata, reel_plan: plan, reel_plan_model: model, reel_plan_phase: "3.8", reel_plan_generated_at: new Date().toISOString(), generation_status: "rendering" } }).eq("organization_id", post.organization_id).eq("id", post.id);
  if (planError) throw planError;

  const result = await fluxSocialRenderReel.triggerAndWait({ organizationId: post.organization_id, postId: post.id });
  if (!result.ok) throw new Error(`Reel render failed: ${String(result.error || "unknown render error")}`);
  const { data: renderedPost, error: renderedPostError } = await supabase
    .from("social_posts")
    .select("id,organization_id,brand_id,title,caption,format,status,content,metadata")
    .eq("organization_id", post.organization_id)
    .eq("id", post.id)
    .single();
  if (renderedPostError) throw renderedPostError;
  await markPostMediaReady(supabase, renderedPost as PostRow, {});
  return result.output;
}

async function finalizeWeeklyRun(supabase: SupabaseClient, weeklyRunId: string) {
  const { data: jobs, error } = await supabase.from("social_generation_jobs").select("status,last_error").eq("weekly_run_id", weeklyRunId);
  if (error) throw error;
  const all = jobs || [];
  const counts = {
    total: all.length,
    queued: all.filter((job) => job.status === "queued").length,
    running: all.filter((job) => job.status === "running").length,
    skipped: all.filter((job) => job.status === "skipped").length,
    succeeded: all.filter((job) => job.status === "succeeded").length,
    failed: all.filter((job) => job.status === "failed").length,
  };
  const pending = counts.queued + counts.running;
  let status: "generating" | "review_ready" | "partial_failure" | "failed" = "generating";
  if (pending === 0 && counts.failed === 0) status = "review_ready";
  else if (pending === 0 && counts.failed > 0 && counts.succeeded + counts.skipped > 0) status = "partial_failure";
  else if (pending === 0 && counts.failed > 0) status = "failed";

  const lastError = status === "partial_failure" || status === "failed"
    ? all.find((job) => job.status === "failed")?.last_error || "One or more media generation jobs failed."
    : null;
  const { error: runError } = await supabase.from("social_weekly_runs").update({
    status,
    generation_summary: counts,
    last_error: lastError,
    completed_at: status === "generating" ? null : new Date().toISOString(),
  }).eq("id", weeklyRunId);
  if (runError) throw runError;
  return { status, counts };
}

export const fluxSocialGenerationWorker = task({
  id: "flux-social-generation-worker",
  maxDuration: 900,
  retry: { maxAttempts: 2, minTimeoutInMs: 15_000, maxTimeoutInMs: 60_000, factor: 2 },
  run: async (payload: { weeklyRunId: string }) => {
    const supabase = createSocialAdminClient();
    const { data: run, error: runError } = await supabase.from("social_weekly_runs").select("id,organization_id,brand_id,status").eq("id", payload.weeklyRunId).single();
    if (runError) throw runError;
    if (["review_ready", "failed"].includes(run.status)) return { weeklyRunId: run.id, skipped: true, status: run.status };

    const { data: brand, error: brandError } = await supabase.from("social_brands").select("id,organization_id,name,audience,tone,products").eq("organization_id", run.organization_id).eq("id", run.brand_id).single();
    if (brandError) throw brandError;

    const { data: jobs, error: jobsError } = await supabase.from("social_generation_jobs").select("*").eq("weekly_run_id", run.id).eq("status", "queued").order("created_at", { ascending: true });
    if (jobsError) throw jobsError;

    for (const rawJob of jobs || []) {
      const job = rawJob as GenerationJob;
      const now = new Date().toISOString();
      const { data: claimed, error: claimError } = await supabase.from("social_generation_jobs").update({ status: "running", attempt_count: Number(job.attempt_count || 0) + 1, started_at: now, last_error: null }).eq("id", job.id).eq("status", "queued").select("id").maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) continue;

      try {
        const { data: post, error: postError } = await supabase.from("social_posts").select("id,organization_id,brand_id,title,caption,format,status,content,metadata").eq("organization_id", run.organization_id).eq("id", job.post_id).single();
        if (postError) throw postError;
        const typedPost = post as PostRow;

        let output: unknown;
        if (job.job_type === "static") {
          const logoUrl = await getCanonicalLogoDataUrl(supabase, run.organization_id, run.brand_id);
          output = await processStatic(supabase, typedPost, logoUrl);
        } else if (job.job_type === "carousel") {
          const logoUrl = await getCanonicalLogoDataUrl(supabase, run.organization_id, run.brand_id);
          output = await processCarousel(supabase, brand as BrandRow, typedPost, logoUrl);
        } else if (job.job_type === "reel_plan" || job.job_type === "reel_render") {
          output = await processReel(supabase, brand as BrandRow, typedPost);
        } else {
          output = { skipped: true };
        }

        const { error: successError } = await supabase.from("social_generation_jobs").update({ status: job.job_type === "none" ? "skipped" : "succeeded", completed_at: new Date().toISOString(), last_error: null, metadata: { ...(job.metadata || {}), output } }).eq("id", job.id);
        if (successError) throw successError;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await supabase.from("social_generation_jobs").update({ status: "failed", completed_at: new Date().toISOString(), last_error: message }).eq("id", job.id);
        const { data: failedPost, error: failedPostError } = await supabase.from("social_posts").select("id,organization_id,brand_id,title,caption,format,status,content,metadata").eq("organization_id", run.organization_id).eq("id", job.post_id).maybeSingle();
        if (failedPostError) throw failedPostError;
        if (failedPost) await markPostMediaFailed(supabase, failedPost as PostRow, message);
        logger.error("Flux Social media generation job failed", { jobId: job.id, postId: job.post_id, jobType: job.job_type, error: message });
      }
    }

    const final = await finalizeWeeklyRun(supabase, run.id);
    logger.info("Flux Social generation worker finished", { weeklyRunId: run.id, ...final });
    return { weeklyRunId: run.id, ...final };
  },
});

export const fluxSocialGenerationSweeper = schedules.task({
  id: "flux-social-generation-sweeper",
  cron: "*/10 * * * *",
  maxDuration: 300,
  retry: { maxAttempts: 2, minTimeoutInMs: 10_000, maxTimeoutInMs: 30_000, factor: 2 },
  run: async () => {
    const supabase = createSocialAdminClient();
    const { data: runs, error } = await supabase.from("social_weekly_runs").select("id").eq("status", "generating").order("created_at", { ascending: true }).limit(20);
    if (error) throw error;
    const triggered: string[] = [];
    for (const run of runs || []) {
      const { count: runningJobs, error: runningJobsError } = await supabase
        .from("social_generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("weekly_run_id", run.id)
        .eq("status", "running");
      if (runningJobsError) throw runningJobsError;
      if ((runningJobs || 0) > 0) continue;

      const handle = await fluxSocialGenerationWorker.trigger({ weeklyRunId: run.id });
      triggered.push(handle.id);
    }
    return { queuedRuns: triggered.length, triggerRunIds: triggered };
  },
});
