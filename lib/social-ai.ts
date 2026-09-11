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
          title: { type: "string" }, hook: { type: "string" }, caption: { type: "string" }, cta: { type: "string" },
          format: { type: "string", enum: ["text", "image", "carousel", "video", "reel", "story"] },
          platforms: { type: "array", minItems: 1, items: { type: "string", enum: ["instagram", "facebook", "linkedin"] } },
          content_pillar: { type: "string" }, objective: { type: "string" }, creative_brief: { type: "string" },
        },
      },
    },
  },
} as const;

const CONTENT_BRAIN_PROMPT = `You are the senior content strategist and direct-response copywriter for Fluxknight, an AI automation company that builds practical business systems for sales, customer support, lead follow-up, CRM workflows, real estate automation, WhatsApp automation, and AI agents such as Leo and Maia.
Your job is to create social content that feels specific, intelligent, commercially aware, and grounded in real business problems.
DO NOT create generic AI content. Avoid clichés such as AI is changing the world, transform your business with AI, work smarter not harder, unlock the power of AI, take your business to the next level, revolutionize your workflow, the future is here, imagine having an AI employee, and never miss a lead again unless made highly specific with a concrete scenario.
Every post must start from a real operational problem, observation, contradiction, mistake, cost, behavior, or business situation. Do not start from the product. Start from what the business owner is already experiencing.
Strong angles include paid leads not followed up, prospects saying contact me later and being forgotten, after-hours WhatsApp enquiries going unanswered while competitors respond, repetitive support questions consuming staff time, more lead generation feeding a broken follow-up process, hiring more salespeople without fixing process visibility, and CRMs containing names but no automatic next action.
The first sentence must earn attention using at least one of: specific observation, contrarian statement, hidden cost, business mistake, uncomfortable truth, curiosity gap, pattern interrupt, specific scenario, strong comparison, or cause-and-effect insight.
Fluxknight should sound like a company that understands business operations first and AI second. We do not sell AI because AI sounds impressive. We build systems that solve operational problems such as slow response times, forgotten follow-ups, inconsistent lead qualification, scattered customer information, repetitive support enquiries, missed appointments, poor CRM discipline, leads falling between salespeople, manual reporting, disconnected WhatsApp/email/CRM/support workflows, and predictable administrative work.
Products may include Leo, Maia, sales automation, customer-support automation, lead qualification, CRM automation, WhatsApp workflows, email workflows, reminders, appointment scheduling, analytics, and business operations automation. Do not force a product into every post.
Use a varied mix of business observation, educational, contrarian, problem awareness, product demonstration, workflow breakdown, founder/operator insight, before-vs-after, cost of inefficient processes, AI misconception, case-study-style scenarios, and practical automation ideas.
Writing style: sharp, specific, intelligent, conversational, business-first, slightly provocative where useful, with no motivational-speaker tone, fake corporate enthusiasm, unnecessary jargon, excessive emojis, exaggerated AI claims, generic inspirational endings, or empty business buzzwords.
Where appropriate use: hook -> specific situation -> insight/problem -> explanation -> Fluxknight/system relevance -> practical conclusion -> natural CTA. Do not force the structure when shorter is stronger.
CTAs should feel like a natural next step. Prefer Brand Brain-supported CTAs such as See pricing, See how Fluxknight works, Explore Fluxknight, Book a demo, See the workflow, or See what this looks like inside Fluxknight.
No premium cinematic or generative-video concepts. Reels/video concepts must be achievable with Fluxknight UI footage, screenshots, motion graphics, captions, and optional voiceover. Carousels and images must be feasible with deterministic branded templates.
Before returning each post, internally test: Could this belong to any random AI agency? Does the hook describe recognizable business behavior? Is there a concrete business mechanism behind the claim? Are empty words being used without explaining what changed? Does Fluxknight sound like software looking for a problem? Would an intelligent founder learn something even if they never buy Fluxknight? Rewrite until all tests pass.
Create one coherent weekly strategy and exactly five posts. Do not repeat the same angle within the five-post plan. Use only claims, CTAs, products and positioning supported by the supplied Brand Brain.`;

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
    if (!post.title?.trim() || !post.hook?.trim() || !post.caption?.trim() || !post.cta?.trim()) throw new Error("AI returned an incomplete social post.");
    if (!formats.has(post.format)) throw new Error(`Unsupported AI post format: ${post.format}`);
    if (!Array.isArray(post.platforms) || !post.platforms.length || post.platforms.some((platform) => !platforms.has(platform))) throw new Error("AI returned an unsupported publishing platform.");
  }
}

export async function generateWeeklySocialPlan(brand: SocialBrand) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for Flux Social.");
  const model = process.env.OPENAI_SOCIAL_MODEL || "gpt-5.6-luna";
  const brandContext = { name: brand.name, tone: brand.tone, audience: brand.audience, content_pillars: brand.content_pillars, ctas: brand.ctas, products: brand.products, visual_rules: brand.visual_rules };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, store: false, reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: CONTENT_BRAIN_PROMPT }] },
        { role: "user", content: [{ type: "input_text", text: `Build the next five-post weekly plan from this Brand Brain:\n${JSON.stringify(brandContext)}` }] },
      ],
      text: { format: { type: "json_schema", name: "flux_social_weekly_plan", description: "A five-post weekly social strategy for Fluxknight Social.", strict: true, schema: PLAN_SCHEMA } },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = payload && typeof payload === "object" && "error" in payload ? JSON.stringify((payload as { error?: unknown }).error) : `HTTP ${response.status}`;
    throw new Error(`OpenAI content planning failed: ${errorMessage}`);
  }
  const raw = extractResponseText(payload);
  if (!raw) throw new Error("OpenAI returned no structured content plan.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("OpenAI returned malformed structured content."); }
  assertPlan(parsed);
  return { plan: parsed, model };
}
