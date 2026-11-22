"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRealtySocialAdmin } from "@/lib/social-real-estate-access";
import { realtySocialBrandDefaults, isRealtySocialBrand } from "@/lib/social-real-estate-policy";
import { prepareRealtySocialDrafts } from "@/lib/social-real-estate";
import {getSocialBrand} from "@/lib/social";
import {realtyBrandReadiness} from "@/lib/social-realty-brand";
import {tasks} from "@trigger.dev/sdk";
import {validSocialWeek} from "@/lib/social-week";

export async function setupRealtySocialAction() {
  const {supabase,organizationId,user} = await requireRealtySocialAdmin();
  const existing=await supabase.from("social_brands").select("*").eq("organization_id",organizationId).order("created_at").limit(1).maybeSingle();
  if(existing.error) throw existing.error;
  if(existing.data && !isRealtySocialBrand(existing.data)) throw new Error("This organization's existing brand needs review before enabling its real estate strategy.");
  if(!existing.data) {
    const saved=await supabase.from("social_brands").upsert(realtySocialBrandDefaults(),{onConflict:"organization_id,slug",ignoreDuplicates:true});
    if(saved.error) throw saved.error;
  }
  // A saved brand survives an audit outage. Repeating setup repairs the missing
  // record without replacing its settings or enabling any automatic jobs.
  const previous=await supabase.from("audit_logs").select("id").eq("organization_id",organizationId).eq("action","social.real_estate.brand_configured").limit(1);
  if(previous.error) throw new Error("Brand saved, but audit recording failed. Retry setup to record it.");
  if(!previous.data?.length){
    const audit=await supabase.from("audit_logs").insert({organization_id:organizationId,action:"social.real_estate.brand_configured",resource_type:"social_brand",metadata:{actor_id:user.email,autonomous_publishing:false}});
    if(audit.error) throw new Error("Brand saved, but audit recording failed. Retry setup to record it.");
  }
  revalidatePath("/dashboard/social");redirect("/dashboard/social");
}

export async function generateRealtySocialDraftsAction(_previous:{error:string|null},formData: FormData):Promise<{error:string|null}> {
  const {supabase,organizationId,user}=await requireRealtySocialAdmin();
  let error: string | null = null;
  try {
    const brand=await getSocialBrand();const readiness=await realtyBrandReadiness(supabase,brand);
    if(!readiness.ready)throw Error(readiness.blockers.join(" "));
    const mode=String(formData.get("mode")||"");
    if(mode!=="idea"&&mode!=="research") throw new Error("Choose research or a manual idea.");
    const result=await prepareRealtySocialDrafts(supabase,organizationId,{mode,idea:String(formData.get("idea")||"").trim(),requestId:String(formData.get("request_id")||""),actor:user.email||user.id,format:"carousel"});
    for(const postId of result.postIds){
      const current=await supabase.from("social_posts").select("id,status,format,metadata").eq("organization_id",organizationId).eq("id",postId).single();
      if(current.error)throw Error("The saved draft could not be checked. Open Review before retrying.");
      if(current.data.format!=="carousel"||!["draft","review"].includes(current.data.status)||["ready","rendering"].includes(current.data.metadata?.carousel_render_status))continue;
      const queued=await supabase.from("social_posts").update({metadata:{...current.data.metadata,carousel_render_status:"queued",carousel_render_error:null}}).eq("organization_id",organizationId).eq("id",postId).in("status",["draft","review"]).select("id").maybeSingle();
      if(queued.error)throw Error("Draft saved, but its media status could not be updated. Open Review to retry.");
      if(!queued.data)continue;
      try{await tasks.trigger("flux-social-render-carousel",{organizationId,postId},{idempotencyKey:`realty-manual-carousel:${postId}`});}
      catch{
        await supabase.from("social_posts").update({metadata:{...current.data.metadata,carousel_render_status:"queue_failed",carousel_render_error:"Carousel preparation could not be queued. Retry from Review."}}).eq("organization_id",organizationId).eq("id",postId).in("status",["draft","review"]);
        throw Error("Drafts were saved, but carousel preparation could not be queued. Open Review to retry media generation.");
      }
    }
  } catch(caught) { error=caught instanceof Error ? caught.message.slice(0,240) : "Draft generation failed. Please retry."; }
  revalidatePath("/dashboard/social");revalidatePath("/dashboard/social/posts");revalidatePath("/dashboard/social/review");
  if(error) return {error};
  redirect("/dashboard/social/review?week=all");
}

export async function prepareRealtyWeekAction(_previous:{error:string|null;message:string|null},form:FormData):Promise<{error:string|null;message:string|null}>{
  const {supabase,organizationId,user}=await requireRealtySocialAdmin();
  try{
    const weekStart=String(form.get("week_start")||""),requestId=String(form.get("request_id")||"");
    if(!validSocialWeek(weekStart)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw Error("Choose a starting Monday and retry the request.");
    const brand=await getSocialBrand(),readiness=await realtyBrandReadiness(supabase,brand);
    if(!brand||!readiness.ready)throw Error(readiness.blockers.join(" "));
    const audit=await supabase.from("audit_logs").insert({organization_id:organizationId,action:"social.real_estate.weekly_requested",resource_type:"social_brand",resource_id:brand.id,metadata:{actor_id:user.email,week_start:weekStart,request_id:requestId,outcome:"requested"}});
    if(audit.error)throw Error("The request could not be recorded. Nothing was queued.");
    try{await tasks.trigger("flux-social-prepare-review-week",{organizationId,brandId:brand.id,weekStart,manual:true},{idempotencyKey:`realty-week-request:${organizationId}:${weekStart}:${requestId}`});}
    catch{throw Error("Weekly preparation could not be queued. Please retry.");}
    revalidatePath("/dashboard/social");return{error:null,message:"Weekly carousel preparation was queued. Refresh the review queue to see the generated drafts and media status."};
  }catch(error){return{error:error instanceof Error?error.message:"Weekly preparation failed.",message:null};}
}
