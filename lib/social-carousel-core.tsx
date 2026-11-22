import type { SocialMediaIdentity } from "@/lib/social-media-identity";
// Pure Fluxknight carousel planning and template code.
// Do not import Next.js request helpers here: Trigger.dev loads this module
// while indexing every worker, including Maia.
export const WIDTH = 1080;
export const HEIGHT = 1350;
export const FLUX_SOCIAL_CAROUSEL_TEMPLATE = "fluxknight-social-carousel-v1";

export type CarouselSlide = {
  type: "hook" | "problem" | "insight" | "example" | "solution" | "cta";
  headline: string;
  body: string;
};

type CarouselPlan = {
  title: string;
  slides: CarouselSlide[];
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

function clamp(value: string, max: number) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

export async function generateCarouselPlan(input: {
  title: string;
  hook: string;
  caption: string;
  cta: string;
  contentPillar: string;
  objective: string;
  creativeBrief: string;
  audience: string;
  brandContext?: { name: string; editorialPolicy: string; sourceLinks?:Array<{url:string;title:string}> };
}) {
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
          content: [{ type: "input_text", text: input.brandContext ? `${input.brandContext.editorialPolicy} Create a 5-8 slide property education carousel from the supplied concept and sources. Use only its supported claims, captions and CTA. Do not introduce automation products or another company. Each slide advances the story. Keep copy concise, with a final approved CTA.` : [
            "You are the carousel editor for Fluxknight, a business-operations-first AI automation company.",
            "Turn one approved social post concept into a 5-8 slide Instagram/LinkedIn carousel.",
            "The first slide must earn attention with a specific, sharp hook. Each following slide must advance the argument rather than repeat it.",
            "Use concrete business mechanisms, scenarios, mistakes, costs, or operational insights. Avoid generic AI language and empty words like transform, revolutionary, seamless, innovation, efficiency unless the mechanism is explained.",
            "Do not invent statistics, customer results, or claims not present in the source post.",
            "Keep headlines concise enough for a designed slide. Bodies should usually be 1-3 short sentences.",
            "The final slide should end naturally with the supplied CTA. Do not turn the carousel into a hard sell.",
            "Could this belong to any random AI agency? If yes, rewrite it to be more specific to Fluxknight's positioning around lead follow-up, support, CRM, WhatsApp, sales workflows and business operations.",
          ].join(" ") }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: `Build the carousel from this post:\n${JSON.stringify(input)}` }],
        },
      ],
      text: { format: { type: "json_schema", name: "flux_social_carousel", strict: true, schema: CAROUSEL_SCHEMA } },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`OpenAI carousel planning failed: HTTP ${response.status}`);
  const raw = extractResponseText(payload);
  if (!raw) throw new Error("OpenAI returned no carousel plan.");
  const parsed = JSON.parse(raw) as CarouselPlan;
  if (!Array.isArray(parsed.slides) || parsed.slides.length < 5 || parsed.slides.length > 8) throw new Error("Carousel must contain 5-8 slides.");
  if(input.brandContext&&parsed.slides.some(slide=>typeof slide.headline!=="string"||slide.headline.length>120||typeof slide.body!=="string"||slide.body.length>270))throw Error("Carousel copy exceeds the approved slide layout. Retry with shorter copy.");
  if(input.brandContext&&/fluxknight|talk\s+to\s+leo/i.test(JSON.stringify(parsed)))throw Error("The carousel includes another organization's promotion.");
  return { plan: parsed, model };
}

export async function renderSlide(input: {
  brandName: string;
  logoUrl: string | null;
  slide: CarouselSlide;
  index: number;
  total: number;
  pillar: string;
  identity?: SocialMediaIdentity;
}) {
  // Load Next's bundled OG renderer only when rendering a slide. Eager import
  // fails during Trigger's task-file indexing in the independent Node runtime.
  const { ImageResponse } = await import("next/dist/compiled/@vercel/og/index.node.js");
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
      padding: "72px 72px 58px", color: input.identity?.text || "white", fontFamily: input.identity?.font || "Arial, Helvetica, sans-serif", position: "relative", overflow: "hidden",
      background: input.identity?.background || "radial-gradient(circle at 82% 12%, rgba(124,58,237,0.34), transparent 34%), radial-gradient(circle at 18% 78%, rgba(76,29,149,0.22), transparent 40%), linear-gradient(145deg,#050507 0%,#0b0b12 55%,#050507 100%)",
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.08, backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "54px 54px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ width: 210, height: 148, display: "flex", alignItems: "center", justifyContent: "flex-start", flexShrink: 0 }}>
          {input.logoUrl ? (
            <img src={input.logoUrl} alt={input.brandName} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "left center" }} />
          ) : (
            <span style={{ fontSize: 27, letterSpacing: "0.06em", fontWeight: 800 }}>{input.brandName}</span>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 20, color: input.identity?.muted || "#a1a1aa" }}>{String(input.index).padStart(2, "0")} / {String(input.total).padStart(2, "0")}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative", maxWidth: 900 }}>
        <div style={{ display: "flex", alignSelf: "flex-start", border: input.identity ? `1px solid ${input.identity.accent}` : "1px solid rgba(139,92,246,.42)", background: input.identity?.surface || "rgba(139,92,246,.08)", borderRadius: 999, padding: "10px 18px", color: input.identity?.accent || "#c4b5fd", fontSize: 21 }}>
          {clamp(input.index === 1 ? input.pillar : input.slide.type.toUpperCase(), 38)}
        </div>
        <div style={{ fontSize: input.index === 1 ? 84 : 72, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.04em" }}>
          {clamp(input.slide.headline, input.index === 1 ? 120 : 100)}
        </div>
        {input.slide.body ? <div style={{ fontSize: 34, lineHeight: 1.3, color: input.identity?.muted || "#d4d4d8", maxWidth: 870 }}>{clamp(input.slide.body, 270)}</div> : null}
        <div style={{ width: 140, height: 7, borderRadius: 99, background: input.identity?.accent || "linear-gradient(90deg,#8b5cf6,#c084fc)" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", position: "relative", fontSize: 21 }}>
        <span style={{ color: input.identity?.muted || "#a1a1aa",...(input.identity?{maxWidth:610,minWidth:0}: {}) }}>{input.identity?.footer || "Turn enquiries into sales opportunities."}</span>
        <span style={{ color: input.identity?.accent || "#a78bfa", fontWeight: 700 }}>{input.identity ? (input.identity.website && new URL(input.identity.website).hostname.length<=35 ? new URL(input.identity.website).hostname : input.brandName) : input.brandName === "Fluxknight" ? "fluxknight.space" : input.brandName}</span>
      </div>
    </div>,
    { width: WIDTH, height: HEIGHT },
  );
}

