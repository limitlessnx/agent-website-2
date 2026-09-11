import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { logger, schedules, task } from "@trigger.dev/sdk";
import { fluxSocialRenderReel } from "./social-reel-renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactElement } from "react";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";
const SOCIAL_ASSET_BUCKET = "flux-social-assets";
const WIDTH = 1080;
const HEIGHT = 1350;
const GEIST_REGULAR_FONT_PATH = path.join(process.cwd(), "node_modules", "next", "dist", "compiled", "@vercel", "og", "Geist-Regular.ttf");
let geistRegularFont: Promise<ArrayBuffer> | undefined;

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

async function getCanonicalLogoUrl(supabase: SupabaseClient, organizationId: string, brandId: string) {
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
    .select("bucket_id,storage_path")
    .eq("organization_id", organizationId)
    .eq("id", registry.social_asset_id)
    .single();
  if (assetError) throw assetError;

  const { data: signed, error: signedError } = await supabase.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 3600);
  if (signedError) throw signedError;
  return signed.signedUrl;
}

async function loadGeistRegularFont() {
  geistRegularFont ??= readFile(GEIST_REGULAR_FONT_PATH).then((font) =>
    font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength),
  );
  return geistRegularFont;
}

async function imageResponse(children: ReactElement) {
  return new ImageResponse(children, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: "Geist", data: await loadGeistRegularFont(), style: "normal", weight: 400 }],
  });
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

async function renderStatic(input: { logoUrl: string; hook: string; pillar: string; footer: string }) {
  return imageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "76px 72px 62px", color: "white", fontFamily: "Arial, Helvetica, sans-serif", background: "radial-gradient(circle at 82% 12%, rgba(124,58,237,.38), transparent 34%), linear-gradient(145deg,#050507,#0b0b12 55%,#050507)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: .08, backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "54px 54px" }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <img src={input.logoUrl} style={{ width: 250, height: 72, objectFit: "contain", objectPosition: "left center" }} />
        <div style={{ fontSize: 18, color: "#a1a1aa", letterSpacing: ".08em" }}>AI BUSINESS SYSTEMS</div>
      </div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 28, maxWidth: 900 }}>
        <div style={{ display: "flex", alignSelf: "flex-start", border: "1px solid rgba(139,92,246,.42)", background: "rgba(139,92,246,.08)", borderRadius: 999, padding: "10px 18px", color: "#c4b5fd", fontSize: 22 }}>{input.pillar.slice(0, 42)}</div>
        <div style={{ fontSize: 86, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-.045em" }}>{input.hook.slice(0, 140)}</div>
        <div style={{ width: 150, height: 8, borderRadius: 99, background: "linear-gradient(90deg,#8b5cf6,#c084fc)" }} />
      </div>
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 22, color: "#d4d4d8", maxWidth: 700, lineHeight: 1.35 }}>{input.footer.slice(0, 120)}</div>
        <div style={{ fontSize: 21, color: "#a78bfa", fontWeight: 700 }}>Fluxknight.space</div>
      </div>
    </div>,
  );
}

async function renderCarouselSlide(input: { logoUrl: string; slide: { type: string; headline: string; body: string }; index: number; total: number; pillar: string }) {
  return imageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 72px 58px", color: "white", fontFamily: "Arial, Helvetica, sans-serif", background: "radial-gradient(circle at 82% 12%, rgba(124,58,237,.34), transparent 34%), linear-gradient(145deg,#050507,#0b0b12 55%,#050507)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: .08, backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "54px 54px" }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <img src={input.logoUrl} style={{ width: 250, height: 72, objectFit: "contain", objectPosition: "left center" }} />
        <div style={{ fontSize: 20, color: "#a1a1aa" }}>{String(input.index).padStart(2, "0")} / {String(input.total).padStart(2, "0")}</div>
      </div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 28, maxWidth: 900 }}>
        <div style={{ display: "flex", alignSelf: "flex-start", border: "1px solid rgba(139,92,246,.42)", background: "rgba(139,92,246,.08)", borderRadius: 999, padding: "10px 18px", color: "#c4b5fd", fontSize: 21 }}>{(input.index === 1 ? input.pillar : input.slide.type.toUpperCase()).slice(0, 38)}</div>
        <div style={{ fontSize: input.index === 1 ? 84 : 72, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-.04em" }}>{input.slide.headline.slice(0, input.index === 1 ? 120 : 100)}</div>
        <div style={{ fontSize: 34, lineHeight: 1.3, color: "#d4d4d8", maxWidth: 870 }}>{input.slide.body.slice(0, 270)}</div>
        <div style={{ width: 140, height: 7, borderRadius: 99, background: "linear-gradient(90deg,#8b5cf6,#c084fc)" }} />
      </div>
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", fontSize: 21 }}>
        <span style={{ color: "#a1a1aa" }}>Business systems, not AI theatre.</span>
        <span style={{ color: "#a78bfa", fontWeight: 700 }}>Fluxknight.space</span>
      </div>
    </div>,
  );
}

async function processStatic(supabase: SupabaseClient, post: PostRow, logoUrl: string) {
  const content = post.content || {};
  const response = await renderStatic({
    logoUrl,
    hook: String(content.hook || post.title || "Build a smarter operating system."),
    pillar: String(content.content_pillar || "Business automation"),
    footer: String(content.objective || post.caption || "Smarter operations with Fluxknight."),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const assetId = await uploadAsset(supabase, {
    organizationId: post.organization_id,
    brandId: post.brand_id,
    postId: post.id,
    assetType: "image",
    bytes,
    fileName: `fluxknight-static-${post.id}.png`,
    metadata: { renderer: "next-image-response-trigger-v1", template: "fluxknight-social-static-v2", brand_asset_policy: "canonical-logo-only", storage_policy: "supabase-only" },
  });
  const oldAssets = Array.isArray(post.metadata?.media_assets) ? post.metadata.media_assets : [];
  const { error } = await supabase.from("social_posts").update({ metadata: { ...post.metadata, media_assets: [...oldAssets, assetId], primary_asset_id: assetId, static_graphic_template: "fluxknight-social-static-v2", generation_status: "ready" } }).eq("organization_id", post.organization_id).eq("id", post.id);
  if (error) throw error;
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
    const response = await renderCarouselSlide({ logoUrl, slide: slides[i], index: i + 1, total: slides.length, pillar: String(content.content_pillar || "Business automation") });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const assetId = await uploadAsset(supabase, {
      organizationId: post.organization_id,
      brandId: post.brand_id,
      postId: post.id,
      assetType: "carousel_slide",
      bytes,
      fileName: `fluxknight-carousel-${post.id}-${i + 1}.png`,
      metadata: { renderer: "next-image-response-trigger-v1", template: "fluxknight-social-carousel-v2", carousel_index: i + 1, carousel_total: slides.length, slide_type: slides[i].type, model, brand_asset_policy: "canonical-logo-only", storage_policy: "supabase-only" },
    });
    assetIds.push(assetId);
  }

  const oldAssets = Array.isArray(post.metadata?.media_assets) ? post.metadata.media_assets : [];
  const { error } = await supabase.from("social_posts").update({ metadata: { ...post.metadata, media_assets: [...oldAssets, ...assetIds], carousel_asset_ids: assetIds, primary_asset_id: assetIds[0] || null, carousel_plan: parsed, carousel_template: "fluxknight-social-carousel-v2", carousel_generated_at: new Date().toISOString(), generation_status: "ready" } }).eq("organization_id", post.organization_id).eq("id", post.id);
  if (error) throw error;
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
        const { data: post, error: postError } = await supabase.from("social_posts").select("id,organization_id,brand_id,title,caption,format,content,metadata").eq("organization_id", run.organization_id).eq("id", job.post_id).single();
        if (postError) throw postError;
        const typedPost = post as PostRow;

        let output: unknown;
        if (job.job_type === "static") {
          const logoUrl = await getCanonicalLogoUrl(supabase, run.organization_id, run.brand_id);
          output = await processStatic(supabase, typedPost, logoUrl);
        } else if (job.job_type === "carousel") {
          const logoUrl = await getCanonicalLogoUrl(supabase, run.organization_id, run.brand_id);
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
        await supabase.from("social_posts").update({ metadata: { generation_status: "failed", generation_error: message } }).eq("organization_id", run.organization_id).eq("id", job.post_id);
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
      const handle = await fluxSocialGenerationWorker.trigger({ weeklyRunId: run.id });
      triggered.push(handle.id);
    }
    return { queuedRuns: triggered.length, triggerRunIds: triggered };
  },
});
