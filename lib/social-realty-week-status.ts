import type {SupabaseClient} from "@supabase/supabase-js";
import {REALTY_SOCIAL_ORGANIZATION} from "@/lib/social-real-estate-policy";

export async function refreshRealtyWeekStatus(db:SupabaseClient,organizationId:string,brandId:string,weekStart:string){
  if(organizationId!==REALTY_SOCIAL_ORGANIZATION)return;
  const plan=await db.from("social_content_plans").select("id").eq("organization_id",organizationId).eq("brand_id",brandId).eq("week_start",weekStart).maybeSingle();
  if(plan.error)throw plan.error;if(!plan.data)return;
  const posts=await db.from("social_posts").select("id,metadata").eq("organization_id",organizationId).eq("brand_id",brandId).eq("content_plan_id",plan.data.id);
  if(posts.error)throw posts.error;
  const rows=posts.data||[],ready=rows.filter(p=>p.metadata?.carousel_render_status==="ready").length,failed=rows.filter(p=>["failed","queue_failed"].includes(p.metadata?.carousel_render_status)).length;
  const status=rows.length===7&&ready===7?"review_ready":failed||rows.length!==7?"partial_failure":"generating";
  const saved=await db.from("social_weekly_runs").update({content_plan_id:plan.data.id,post_ids:rows.map(p=>p.id),status,generation_summary:{total:rows.length,ready,failed,preparing:rows.length-ready-failed},last_error:status==="partial_failure"?"The saved batch needs attention. Review failed or missing carousel media before retrying.":null,completed_at:status==="review_ready"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("organization_id",organizationId).eq("brand_id",brandId).eq("week_start",weekStart);
  if(saved.error)throw saved.error;
}
