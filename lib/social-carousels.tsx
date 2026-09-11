import { ImageResponse } from "next/og";
import { getSocialBrand } from "@/lib/social";
import { uploadSocialAsset } from "@/lib/social-assets";
import { requireTenant } from "@/lib/tenant";

const WIDTH = 1080;
const HEIGHT = 1350;

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

async function generateCarouselPlan(input: {
  title: string;
  hook: string;
  caption: string;
  cta: string;
  contentPillar: string;
  objective: string;
  creativeBrief: string;
  audience: string;
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
          content: [{ type: "input_text", text: [
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
  return { plan: parsed, model };
}

function renderSlide(input: {
  brandName: string;
  slide: CarouselSlide;
  index: number;
  total: number;
  pillar: string;
}) {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
      padding: "72px 72px 58px", color: "white", fontFamily: "Arial, Helvetica, sans-serif", position: "relative", overflow: "hidden",
      background: "radial-gradient(circle at 82% 12%, rgba(124,58,237,0.34), transparent 34%), radial-gradient(circle at 18% 78%, rgba(76,29,149,0.22), transparent 40%), linear-gradient(145deg,#050507 0%,#0b0b12 55%,#050507 100%)",
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.08, backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "54px 54px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ display: "flex", gap: 2, alignItems: "baseline", fontSize: 28, letterSpacing: "0.16em", fontWeight: 800 }}>
          <span>FLU</span><span style={{ color: "#8b5cf6" }}>X</span><span>KNIGHT</span>
        </div>
        <div style={{ fontSize: 20, color: "#a1a1aa" }}>{String(input.index).padStart(2, "0")} / {String(input.total).padStart(2, "0")}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative", maxWidth: 900 }}>
        <div style={{ display: "flex", alignSelf: "flex-start", border: "1px solid rgba(139,92,246,.42)", background: "rgba(139,92,246,.08)", borderRadius: 999, padding: "10px 18px", color: "#c4b5fd", fontSize: 21 }}>
          {clamp(input.index === 1 ? input.pillar : input.slide.type.toUpperCase(), 38)}
        </div>
        <div style={{ fontSize: input.index === 1 ? 84 : 72, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.04em" }}>
          {clamp(input.slide.headline, input.index === 1 ? 120 : 100)}
        </div>
        {input.slide.body ? <div style={{ fontSize: 34, lineHeight: 1.3, color: "#d4d4d8", maxWidth: 870 }}>{clamp(input.slide.body, 270)}</div> : null}
        <div style={{ width: 140, height: 7, borderRadius: 99, background: "linear-gradient(90deg,#8b5cf6,#c084fc)" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", position: "relative", fontSize: 21 }}>
        <span style={{ color: "#a1a1aa" }}>Business systems, not AI theatre.</span>
        <span style={{ color: "#a78bfa", fontWeight: 700 }}>{input.brandName}.space</span>
      </div>
    </div>,
    { width: WIDTH, height: HEIGHT },
  );
}

export async function generateCarouselForPost(postId: string) {
  const { supabase, organizationId } = await requireTenant();
  const brand = await getSocialBrand();
  if (!brand) throw new Error("A Social Brand is required before generating carousels.");

  const { data: post, error } = await supabase
    .from("social_posts")
    .select("id,brand_id,title,caption,format,content,metadata")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .single();
  if (error) throw error;
  if (post.format !== "carousel") throw new Error("This post is not configured as a carousel.");

  const content = (post.content || {}) as Record<string, unknown>;
  const metadata = (post.metadata || {}) as Record<string, unknown>;
  const hook = String(content.hook || post.title || "");
  const cta = String(content.cta || "See how Fluxknight works");
  const contentPillar = String(content.content_pillar || "Business automation");
  const objective = String(content.objective || "");
  const creativeBrief = String(content.creative_brief || "");

  const { plan, model } = await generateCarouselPlan({
    title: post.title || "",
    hook,
    caption: post.caption || "",
    cta,
    contentPillar,
    objective,
    creativeBrief,
    audience: brand.audience,
  });

  const assets = [];
  for (let i = 0; i < plan.slides.length; i += 1) {
    const slide = plan.slides[i];
    const response = renderSlide({ brandName: brand.name, slide, index: i + 1, total: plan.slides.length, pillar: contentPillar });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const asset = await uploadSocialAsset({
      postId: post.id,
      brandId: post.brand_id,
      assetType: "carousel_slide",
      source: "system",
      fileName: `fluxknight-carousel-${post.id}-${i + 1}.png`,
      mimeType: "image/png",
      body: bytes,
      sizeBytes: bytes.byteLength,
      width: WIDTH,
      height: HEIGHT,
      metadata: {
        renderer: "next-image-response-v1",
        template: "fluxknight-social-carousel-v1",
        carousel_index: i + 1,
        carousel_total: plan.slides.length,
        slide_type: slide.type,
        generated_from: slide,
        model,
        storage_policy: "supabase-only",
      },
    });
    assets.push(asset);
  }

  const existingAssetIds = Array.isArray(metadata.media_assets) ? metadata.media_assets : [];
  const carouselAssetIds = assets.map((asset) => asset.id);
  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      metadata: {
        ...metadata,
        media_assets: [...existingAssetIds, ...carouselAssetIds],
        carousel_asset_ids: carouselAssetIds,
        primary_asset_id: carouselAssetIds[0] || null,
        carousel_plan: plan,
        carousel_template: "fluxknight-social-carousel-v1",
        carousel_generated_at: new Date().toISOString(),
      },
    })
    .eq("organization_id", organizationId)
    .eq("id", post.id);
  if (updateError) throw updateError;

  return { assets, plan, model };
}
