"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRealtySocialAdmin } from "@/lib/social-real-estate-access";
import { realtySocialBrandDefaults, isRealtySocialBrand } from "@/lib/social-real-estate-policy";
import { prepareRealtySocialDrafts } from "@/lib/social-real-estate";

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
  revalidatePath("/dashboard/social");redirect("/dashboard/social/create");
}

export async function generateRealtySocialDraftsAction(_previous:{error:string|null},formData: FormData):Promise<{error:string|null}> {
  const {supabase,organizationId,user}=await requireRealtySocialAdmin();
  let error: string | null = null;
  try {
    const mode=String(formData.get("mode")||"");
    if(mode!=="idea"&&mode!=="research") throw new Error("Choose research or a manual idea.");
    await prepareRealtySocialDrafts(supabase,organizationId,{mode,idea:String(formData.get("idea")||"").trim(),requestId:String(formData.get("request_id")||""),actor:user.email||user.id});
  } catch(caught) { error=caught instanceof Error ? caught.message.slice(0,240) : "Draft generation failed. Please retry."; }
  revalidatePath("/dashboard/social");revalidatePath("/dashboard/social/posts");revalidatePath("/dashboard/social/review");
  if(error) return {error};
  redirect("/dashboard/social/review?week=all");
}
