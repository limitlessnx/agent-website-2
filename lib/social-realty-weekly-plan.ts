import type {SocialBrand} from "@/lib/social";
import type {WeeklySocialPlan} from "@/lib/social-ai";
import {generateRealtyDraftCopy} from "@/lib/social-real-estate";
import {socialMediaIdentity} from "@/lib/social-media-identity";

// Copy planning only. Persistence, media queues and review use the shared planner.
export async function generateRealtyWeeklyPlan(brand:SocialBrand){
  socialMediaIdentity(brand);
  const formats=Array<"carousel">(7).fill("carousel");
  const result=await generateRealtyDraftCopy(brand,{mode:"research",idea:"Create a varied carousel-only weekly batch of Nigerian property news and buyer education. Use original reporting where possible and relevant Edo/Benin developments when supported. Do not repeat recent hooks.",requestId:"weekly-planning",actor:"shared-weekly-planner"},formats);
  const observedAt=new Date().toISOString();
  const plan:WeeklySocialPlan={strategy_summary:"Sourced Nigerian real estate coverage and practical property education.",weekly_objective:"Prepare seven branded carousels for human review.",audience_angle:brand.audience,posts:result.posts.map(post=>({title:post.title,hook:post.hook,caption:post.caption,cta:post.cta,format:"carousel",platforms:["instagram"],content_pillar:"Nigerian real estate",objective:post.cta,creative_brief:post.visual_brief,source_links:result.sources.filter(source=>post.source_urls.includes(source.url)),research_observed_at:observedAt}))};
  return{plan,model:process.env.OPENAI_SOCIAL_MODEL||"gpt-5.6-luna"};
}
