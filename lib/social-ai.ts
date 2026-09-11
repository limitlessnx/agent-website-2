import type { SocialBrand, SocialPlatform, SocialPostFormat } from "@/lib/social";

export type WeeklySocialPostIdea = {
  title: string;
  hook: string;
  caption: string;
  cta: string;
  format: SocialPostFormat;
  platforms: SocialPlatform[];
  content_pillar: string;
  objective: string;
  creative_brief: string;
};

export type WeeklySocialPlan = {
  strategy_summary: string;
  weekly_objective: string;
  audience_angle: string;
  posts: WeeklySocialPostIdea[];
};

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["strategy_summary", "weekly_objective", "audience_angle", "posts"],
  properties: {
    strategy_summary: { type: "string" },
    weekly_objective: { type: "string" },
    audience_angle: { type: "string" },
    posts: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "hook", "caption", "cta", "format", "platforms", "content_pillar", "objective", "creative_brief"],
        properties: {
          title: { type: "string" },
          hook: { type: "string" },
          caption: { type: "string" },
          cta: { type: "string" },
          format: { type: "string", enum: ["text", "image", "carousel", "video", "reel", "story"] },
          platforms: {
            type: "array",
            minItems: 1,
            items: { type: "string", enum: ["instagram", "facebook", "linkedin"] },
          },
          content_pillar: { type: "string" },
          objective: { type: "string" },
          creative_brief: { type: "string" },
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

function assertPlan(value: unknown): asserts value is WeeklySocialPlan {
  if (!value || typeof value !== "object") throw new Error("AI returned an invalid weekly content plan.");
  const plan = value as WeeklySocialPlan;
  if (!Array.isArray(plan.posts) || plan.posts.length !== 5) throw new Error("AI must return exactly five social posts.");

  const formats = new Set(["text", "image", "carousel", "video", "reel", "story"]);
  const platforms = new Set(["instagram", "facebook", "linkedin"]);
  for (const post of plan.posts) {
    if (!post.title?.trim() || !post.hook?.trim() || !post.caption?.trim() || !post.cta?.trim()) {
      throw new Error("AI returned an incomplete social post.");
    }
    if (!formats.has(post.format)) throw new Error(`Unsupported AI post format: ${post.format}`);
    if (!Array.isArray(post.platforms) || !post.platforms.length || post.platforms.some((platform) => !platforms.has(platform))) {
      throw new Error("AI returned an unsupported publishing platform.");
    }
  }
}

export async function generateWeeklySocialPlan(brand: SocialBrand) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for Flux Social.");

  const model = process.env.OPENAI_SOCIAL_MODEL || "gpt-5.6-luna";
  const brandContext = {
    name: brand.name,
    tone: brand.tone,
    audience: brand.audience,
    content_pillars: brand.content_pillars,
    ctas: brand.ctas,
    products: brand.products,
    visual_rules: brand.visual_rules,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: [{
            type: "input_text",
            text: [
              "You are Fluxknight Social's content strategist.",
              "Create one coherent weekly social strategy and exactly five genuinely useful posts.",
              "Write for business operators, not for an AI-hype audience.",
              "Use sharp, specific hooks and practical copy. Avoid generic motivational language, fake statistics, unsupported promises, and invented customer results.",
              "Choose formats intentionally. Use a varied mix where useful, with no premium cinematic or generative-video concepts.",
              "Reels/video concepts must be achievable with product UI footage, screenshots, motion graphics, captions, and optional voiceover.",
              "Carousels and images should be feasible with deterministic branded templates.",
              "Use only CTAs and product positioning supported by the supplied Brand Brain.",
            ].join(" "),
          }],
        },
        {
          role: "user",
          content: [{
            type: "input_text",
            text: `Build the next five-post weekly plan from this Brand Brain:\n${JSON.stringify(brandContext)}`,
          }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "flux_social_weekly_plan",
          description: "A five-post weekly social strategy for Fluxknight Social.",
          strict: true,
          schema: PLAN_SCHEMA,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = payload && typeof payload === "object" && "error" in payload
      ? JSON.stringify((payload as { error?: unknown }).error)
      : `HTTP ${response.status}`;
    throw new Error(`OpenAI content planning failed: ${errorMessage}`);
  }

  const raw = extractResponseText(payload);
  if (!raw) throw new Error("OpenAI returned no structured content plan.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned malformed structured content.");
  }

  assertPlan(parsed);
  return { plan: parsed, model };
}
