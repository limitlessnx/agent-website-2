import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialBrand } from "@/lib/social";
import { isRealtySocialBrand, REALTY_SOCIAL_ORGANIZATION, REALTY_SOCIAL_PROMPT } from "@/lib/social-real-estate-policy";
import { socialWeekStart } from "@/lib/social-week";

export type RealtySource = { url: string; title: string };
type Draft = { title: string; hook: string; caption: string; cta: string; visual_brief: string; source_urls: string[] };
export type RealtyDraftRequest = { mode: "research" | "idea"; idea: string; requestId: string; actor: string };

function publicUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) && !u.hostname.endsWith(".local") ? u.href : null;
  } catch { return null; }
}

function outputText(payload: Record<string, unknown>) {
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.flatMap((item) => Array.isArray(item.content) ? item.content : []).filter((item) => item.type === "output_text" && typeof item.text === "string").map((item) => item.text).join("\n");
}

export function realtyResearchSources(payload: Record<string, unknown>): RealtySource[] {
  const found = new Map<string, RealtySource>();
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (item.type !== "web_search_call" || item.status !== "completed") continue;
    for (const source of Array.isArray(item.action?.sources) ? item.action.sources : []) {
      const url = typeof source.url === "string" ? publicUrl(source.url) : null;
      if (url) found.set(url, { url, title: String(source.title || new URL(url).hostname).slice(0, 220) });
    }
  }
  return [...found.values()].slice(0, 12);
}

async function responses(body: Record<string, unknown>) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Content generation is not configured. No drafts were created.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal: AbortSignal.timeout(90000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_SOCIAL_MODEL || "gpt-5.6-luna", store: false, ...body }),
  });
  if (!response.ok) throw new Error(`Content provider unavailable (HTTP ${response.status}). Retry without approving or scheduling anything.`);
  return await response.json() as Record<string, unknown>;
}

export async function generateRealtyDraftCopy(brand: SocialBrand, request: RealtyDraftRequest) {
  if (!isRealtySocialBrand(brand)) throw new Error("Real estate strategy is not enabled for this organization.");
  const count = request.mode === "research" ? 3 : 1;
  let sources: RealtySource[] = [], coverage = "";
  if (request.mode === "research") {
    const researched = await responses({
      tools: [{ type: "web_search", user_location: { type: "approximate", country: "NG" } }], tool_choice: "required",
      include: ["web_search_call.action.sources"],
      input: [{ role: "system", content: REALTY_SOCIAL_PROMPT }, { role: "user", content: `Today is ${new Date().toISOString().slice(0,10)}. Research recent Nigerian real estate coverage, preferably from the past 14 days, prioritizing original reporting and government/official sources. Include relevant Edo State/Benin City developments if supported. Summarize three useful topic candidates, dates when explicitly available and caveats. Do not claim measured popularity. Search the web; do not use memory as current evidence.` }],
    });
    sources = realtyResearchSources(researched); coverage = outputText(researched).slice(0, 18000);
    if (!sources.length || !coverage.trim()) throw new Error("Research returned no usable sourced coverage. No news drafts were created.");
  }
  const fields = { title: {type:"string"}, hook: {type:"string"}, caption: {type:"string"}, cta: {type:"string"}, visual_brief: {type:"string"}, source_urls: {type:"array",items:{type:"string"}} };
  const generated = await responses({
    input: [{role:"system",content:REALTY_SOCIAL_PROMPT},{role:"user",content:JSON.stringify({ instruction:`Create ${count} distinct review drafts. Format is a static image with caption.`, brand:{name:brand.name,tone:brand.tone,audience:brand.audience,ctas:brand.ctas,content_pillars:brand.content_pillars}, mode:request.mode, idea:request.idea, coverage, sources })}],
    text:{format:{type:"json_schema",name:"realty_social_drafts",strict:true,schema:{type:"object",additionalProperties:false,required:["posts"],properties:{posts:{type:"array",minItems:count,maxItems:count,items:{type:"object",additionalProperties:false,required:Object.keys(fields),properties:fields}}}}}},
  });
  let parsed: {posts: Draft[]};
  try { parsed = JSON.parse(outputText(generated)); } catch { throw new Error("The content provider returned malformed drafts. No drafts were saved."); }
  if (!Array.isArray(parsed.posts) || parsed.posts.length !== count) throw new Error("The content provider returned an incomplete draft batch.");
  const allowed = new Set(sources.map(s=>s.url));
  for (const post of parsed.posts) {
    for (const [key,max] of Object.entries({title:160,hook:140,caption:2200,cta:300,visual_brief:2000})) {
      const value = post[key as keyof Draft];
      if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Generated draft fields need correction. Nothing was saved.");
    }
    if (!Array.isArray(post.source_urls) || post.source_urls.some(url=>typeof url!=="string" || !allowed.has(publicUrl(url) || "")) || (request.mode==="research" && !post.source_urls.length)) throw new Error("Generated citations do not match retrieved sources. Nothing was saved.");
    if (/\bfluxknight\b|talk\s+to\s+leo/i.test([post.title,post.hook,post.caption,post.cta,post.visual_brief].join("\n"))) throw new Error("Generated copy contains another brand's promotion. Nothing was saved.");
    post.source_urls = post.source_urls.map(url=>publicUrl(url)!);
  }
  return {posts:parsed.posts,sources};
}

export async function prepareRealtySocialDrafts(db: SupabaseClient, organizationId: string, request: RealtyDraftRequest, generate = generateRealtyDraftCopy) {
  if (organizationId !== REALTY_SOCIAL_ORGANIZATION || !request.actor.trim()) throw new Error("Limitless Realty administrator access is required.");
  if (!["research","idea"].includes(request.mode) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.requestId)) throw new Error("Invalid content request.");
  if (request.idea.length > 4000 || (request.mode==="idea" && !request.idea.trim())) throw new Error("Enter a post idea of up to 4000 characters.");
  const {data:brand,error:brandError} = await db.from("social_brands").select("*").eq("organization_id",organizationId).eq("slug","limitless-realty").maybeSingle();
  if (brandError) throw brandError;
  if (!isRealtySocialBrand(brand)) throw new Error("Set up the Limitless Realty Social Brand first.");
  async function recordAudit(postCount:number) {
    const previous=await db.from("audit_logs").select("id").eq("organization_id",organizationId).eq("action","social.real_estate.drafts_prepared").eq("metadata->>request_id",request.requestId).limit(1);
    if(previous.error) throw new Error("Drafts were saved, but audit recording failed. Review the saved drafts before retrying.");
    if(previous.data?.length) return;
    const audit=await db.from("audit_logs").insert({organization_id:organizationId,action:"social.real_estate.drafts_prepared",resource_type:"social_brand",resource_id:brand.id,metadata:{actor_id:request.actor,mode:request.mode,request_id:request.requestId,post_count:postCount}});
    if(audit.error) throw new Error("Drafts were saved, but audit recording failed. Review the saved drafts before retrying.");
  }
  const existing = await db.from("social_posts").select("id").eq("organization_id",organizationId).eq("brand_id",brand.id).eq("metadata->>realty_request_id",request.requestId);
  if (existing.error) throw existing.error;
  if (existing.data?.length) { await recordAudit(existing.data.length); return {postIds:existing.data.map(p=>p.id),existing:true}; }
  const result = await generate(brand,request), observedAt = new Date().toISOString();
  const rows = result.posts.map((post,index)=>{
    const hex=createHash("sha256").update(`${organizationId}:${request.requestId}:${index}`).digest("hex");
    const id=`${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
    return {id,organization_id:organizationId,brand_id:brand.id,title:post.title,caption:post.caption,format:"image",platforms:["instagram"],status:"review",approved_at:null,published_at:null,media:[],
      content:{source:"limitless_realty_editor",hook:post.hook,cta:post.cta,pillar:"Nigerian real estate",objective:post.cta,creative_brief:post.visual_brief,source_links:result.sources.filter(s=>post.source_urls.includes(s.url)),research_observed_at:request.mode==="research"?observedAt:null,week_start:socialWeekStart(),manual_idea:request.mode==="idea"?request.idea:null},
      metadata:{realty_request_id:request.requestId,generation_mode:request.mode,ai_generated:true,requires_human_review:true,popularity_verified:false}};
  });
  const saved=await db.from("social_posts").upsert(rows,{onConflict:"id",ignoreDuplicates:true});
  if(saved.error) throw saved.error;
  await recordAudit(rows.length);
  return {postIds:rows.map(p=>p.id),existing:false};
}
