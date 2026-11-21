import type {SupabaseClient} from "@supabase/supabase-js";
import {REALTY_SOCIAL_ORGANIZATION,REALTY_SOCIAL_PROFILE,REALTY_SOCIAL_SCHEDULE_SOURCE} from "@/lib/social-real-estate-policy";
import {getSocialReviewReadiness} from "@/lib/social-review-readiness";

// Called by the existing social sweep. Never creates slots, approves posts or
// renders media; it only claims an explicitly requested, still-approved intent.
export async function dispatchRealtySocialSchedules(db:SupabaseClient,now:Date,dispatch:(scheduleId:string,intent:string)=>Promise<unknown>){
  const org=REALTY_SOCIAL_ORGANIZATION;
  const organization=await db.from("organizations").select("status").eq("id",org).maybeSingle();
  if(organization.error)throw organization.error;
  if(organization.data?.status!=="active")return {dispatched:0,reason:"organization_inactive"};
  const brand=await db.from("social_brands").select("id,metadata").eq("organization_id",org).eq("slug","limitless-realty").maybeSingle();
  if(brand.error)throw brand.error;
  if(brand.data?.metadata?.strategy_profile!==REALTY_SOCIAL_PROFILE)return {dispatched:0,reason:"not_configured"};
  const schedules=await db.from("social_schedules").select("*").eq("organization_id",org).eq("metadata->>source",REALTY_SOCIAL_SCHEDULE_SOURCE).in("status",["pending","claimed"]).lt("scheduled_for",new Date(now.getTime()+1).toISOString()).order("scheduled_for").limit(25);
  if(schedules.error)throw schedules.error;
  let dispatched=0;
  for(const schedule of schedules.data||[]){
    if(schedule.status==="claimed"){
      if(schedule.claimed_at&&now.getTime()-Date.parse(schedule.claimed_at)>1200000){
        const failed=await db.from("social_schedules").update({status:"failed",last_error:"Previous delivery outcome is unknown. Check Instagram before retrying to avoid a duplicate."}).eq("organization_id",org).eq("id",schedule.id).eq("status","claimed").eq("claimed_at",schedule.claimed_at);
        if(failed.error)throw failed.error;
      }
      continue;
    }
    const read=await db.from("social_posts").select("*").eq("organization_id",org).eq("id",schedule.post_id).maybeSingle();if(read.error)throw read.error;
    const post=read.data;
    const snapshot=String(schedule.metadata?.approval_snapshot||"");
    if(!post||post.brand_id!==brand.data.id||post.status!=="scheduled"||post.published_at||!post.approved_at||!snapshot||Date.parse(snapshot)!==Date.parse(post.approved_at)||!getSocialReviewReadiness(post).ready||JSON.stringify(schedule.metadata?.publish_platforms)!==JSON.stringify(["instagram"])){
      const cancelled=await db.from("social_schedules").update({status:"cancelled",last_error:"Approval, media or publishing target changed. Review and schedule again."}).eq("organization_id",org).eq("id",schedule.id).eq("status","pending");if(cancelled.error)throw cancelled.error;continue;
    }
    const claimed=await db.from("social_schedules").update({status:"claimed",claimed_at:now.toISOString(),last_error:null}).eq("organization_id",org).eq("id",schedule.id).eq("status","pending").eq("scheduled_for",schedule.scheduled_for).select("id").maybeSingle();
    if(claimed.error)throw claimed.error;if(!claimed.data)continue;
    try{await dispatch(schedule.id,`${schedule.scheduled_for}:${post.approved_at}`);dispatched++;}
    catch{
      const reset=await db.from("social_schedules").update({status:"pending",claimed_at:null,last_error:"Publisher could not be queued. The next cycle will retry the same approved intent."}).eq("organization_id",org).eq("id",schedule.id).eq("status","claimed").eq("claimed_at",now.toISOString());if(reset.error)throw reset.error;
    }
  }
  return {dispatched};
}
