"use server";
import {revalidatePath} from "next/cache";
import {requireRealtySocialAdmin} from "@/lib/social-real-estate-access";
import {validateSocialMediaIdentity} from "@/lib/social-media-identity";
import {getSocialBrand} from "@/lib/social";
import {realtyBrandReadiness} from "@/lib/social-realty-brand";

export async function saveRealtyIdentityAction(_previous:{error:string|null;message:string|null},form:FormData):Promise<{error:string|null;message:string|null}>{
  const {supabase,organizationId,user}=await requireRealtySocialAdmin();
  try{
    const brand=await getSocialBrand();if(!brand)throw Error("Set up the Brand Brain first.");
    const readiness=await realtyBrandReadiness(supabase,brand);
    const identity=validateSocialMediaIdentity(Object.fromEntries([...['background','surface','accent','text','muted','font','footer','website'].map(key=>[key,String(form.get(key)||'')]),['approved',form.get('approved')==='yes'],['logoAssetId',readiness.logoAssetId||'']]));
    const candidate={...brand,visual_rules:{...brand.visual_rules,identity}};
    const verified=await realtyBrandReadiness(supabase,candidate);if(!verified.ready)throw Error(verified.blockers.join(" "));
    const weekly=form.get("weekly_automation")==="yes";
    const audit=await supabase.from("audit_logs").insert({organization_id:organizationId,action:"social.real_estate.identity_approved",resource_type:"social_brand",resource_id:brand.id,metadata:{actor_id:user.email,logo_asset_id:identity.logoAssetId,weekly_preparation_enabled:weekly,formats:["carousel"],outcome:"requested"}});
    if(audit.error)throw Error("Approval could not be recorded. Retry without enabling generation.");
    const saved=await supabase.from("social_brands").update({visual_rules:candidate.visual_rules,metadata:{...brand.metadata,weekly_post_count:7,weekly_review_enabled:weekly,realty_weekly_format:"carousel",identity_approved_at:new Date().toISOString()}}).eq("organization_id",organizationId).eq("id",brand.id);
    if(saved.error)throw Error("Identity could not be saved. Please retry.");
    revalidatePath("/dashboard/social");revalidatePath("/dashboard/social/brand");revalidatePath("/dashboard/social/manual");
    return{error:null,message:"Visual identity saved. Carousel preparation uses this approved logo and palette. Publishing remains review-gated."};
  }catch(error){return{error:error instanceof Error?error.message:"Visual identity could not be saved.",message:null};}
}
