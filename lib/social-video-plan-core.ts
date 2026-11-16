import type { ReelVisual } from "@/src/remotion/reel-visual-model";

export type ReelScene = {
  order: number;
  duration_seconds: number;
  scene_type: "hook" | "ui_demo" | "problem" | "workflow" | "benefit" | "cta";
  voiceover: string;
  on_screen_text: string;
  visual_direction: string;
  source_media: "fluxknight_ui" | "screenshot" | "motion_graphics" | "uploaded_media";
  visual?: ReelVisual;
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
        required: ["order", "duration_seconds", "scene_type", "voiceover", "on_screen_text", "visual_direction", "source_media", "visual"],
        properties: {
          order: { type: "integer", minimum: 1 },
          duration_seconds: { type: "number", minimum: 1, maximum: 20 },
          scene_type: { type: "string", enum: ["hook", "ui_demo", "problem", "workflow", "benefit", "cta"] },
          voiceover: { type: "string" },
          on_screen_text: { type: "string" },
          visual_direction: { type: "string" },
          visual: {
            type: "object", additionalProperties: false, required: ["kind", "title", "items"],
            properties: {
              kind: { type: "string", enum: ["inbox", "question_router", "answer", "capture", "handoff", "overview", "pipeline"] },
              title: { type: "string", maxLength: 48 },
              items: { type: "array", minItems: 2, maxItems: 5, items: { type: "string", maxLength: 80 } },
            },
          },
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

export async function generateReelStoryboard(brand: unknown, post: unknown) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for Flux Social.");
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
            "Create a product-demo or educational Reel using Fluxknight UI footage, screenshots, uploaded business media, motion graphics, captions and mandatory voiceover for every scene.",
            "Aspirational and simulated product visuals are allowed when they represent a capability, target state, scenario or demonstration that Fluxknight can deliver.",
            "Concept dashboards, polished KPI cards, idealized workflows, future-state product scenes and illustrative metrics are allowed for positive product perception.",
            "Do not present invented figures as verified historical customer results, audited case-study outcomes or factual client performance unless the supplied source material confirms them.",
            "When illustrative metrics appear, frame them visually and contextually as examples, scenarios, simulated states or targets rather than verified client history.",
            "The first 2 seconds must earn attention with a specific operational problem or sharp observation.",
            "Keep every scene visually actionable for a Remotion renderer.",
            "Supply structured visual data using the supported inbox, question_router, answer, capture, handoff, overview or pipeline components. The title and items are short audience-facing labels, never production instructions.",
            "question_router needs two branch labels. answer needs two customer questions and one configured-answer description. handoff needs sender, human recipient and context label. capture needs field labels. Other kinds use ordered card labels.",
            "Do not request screenshots, footage or custom illustrations that are not supplied. These visuals are illustrative diagrams and interface examples, not actual product screenshots.",
            "Use real line breaks in on_screen_text, never literal backslash-n sequences. Proofread spelling and grammar before returning the plan.",
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

  if (!Array.isArray(plan.scenes) || !plan.scenes.length || plan.scenes.some((scene) => !scene.voiceover?.trim())) {
    throw new Error("Every video scene requires narration.");
  }
  return { plan, model };
}
