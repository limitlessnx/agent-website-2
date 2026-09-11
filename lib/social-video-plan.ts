import { requireTenant } from "@/lib/tenant";
import { getSocialBrand } from "@/lib/social";

export type ReelScene = {
  order: number;
  duration_seconds: number;
  scene_type: "hook" | "ui_demo" | "problem" | "workflow" | "benefit" | "cta";
  voiceover: string;
  on_screen_text: string;
  visual_direction: string;
  source_media: "fluxknight_ui" | "screenshot" | "motion_graphics" | "uploaded_media";
};

export type ReelPlan = {
  title: string;
  objective: string;
  target_duration_seconds: number;
  hook: string;
  scenes: ReelScene[];
  cta: string;
};

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

export async function generateReelPlanForPost(postId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for Flux Social.");

  const { supabase, organizationId } = await requireTenant();
  const brand = await getSocialBrand();
  if (!brand) throw new Error("A Social Brand is required before generating a Reel plan.");

  const { data: post, error } = await supabase
    .from("social_posts")
    .select("id,title,caption,format,content,metadata")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .single();
  if (error) throw error;
  if (!["reel", "video"].includes(post.format)) throw new Error("Only Reel/video posts can generate a video plan.");

  const model = process.env.OPENAI_SOCIAL_MODEL || "gpt-5.6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: [
            "You are Fluxknight Social's short-form video director.",
            "Create a product-demo or educational Reel using only real Fluxknight UI footage, screenshots, uploaded business media, motion graphics, captions and optional voiceover.",
            "Do not propose cinematic AI-generated footage, avatars, fake customers, fake dashboards, fake metrics or unsupported customer results.",
            "The first 2 seconds must earn attention with a specific operational problem or sharp observation.",
            "Keep every scene visually actionable for a Remotion renderer.",
            "Use the exact supplied post idea. Do not replace it with generic AI messaging.",
            "End with a natural Fluxknight CTA supported by the post.",
          ].join(" ") }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: `Build a Reel storyboard from this Fluxknight post:\n${JSON.stringify({ brand, post })}` }],
        },
      ],
      text: { format: { type: "json_schema", name: "flux_social_reel_plan", strict: true, schema: REEL_SCHEMA } },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`OpenAI Reel planning failed: HTTP ${response.status}`);
  const raw = extractResponseText(payload);
  if (!raw) throw new Error("OpenAI returned no Reel plan.");
  const plan = JSON.parse(raw) as ReelPlan;

  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      metadata: {
        ...(post.metadata || {}),
        reel_plan: plan,
        reel_plan_model: model,
        reel_plan_phase: "3.5",
        reel_plan_generated_at: new Date().toISOString(),
      },
    })
    .eq("organization_id", organizationId)
    .eq("id", postId);
  if (updateError) throw updateError;

  return plan;
}
