import type {SupabaseClient} from "@supabase/supabase-js";
import type {SocialBrand} from "@/lib/social";
import {isRealtySocialBrand} from "@/lib/social-real-estate-policy";
import {socialMediaIdentity, type SocialMediaIdentity} from "@/lib/social-media-identity";

export async function realtyBrandReadiness(db:SupabaseClient,brand:SocialBrand|null){
  const blockers:string[]=[];let identity:SocialMediaIdentity|undefined;
  if(!brand||!isRealtySocialBrand(brand))return{ready:false,blockers:["Set up Limitless Realty's Brand Brain."],identity};
  try{identity=socialMediaIdentity(brand);}catch(error){blockers.push(error instanceof Error?error.message:"Approve the visual identity.");}
  const registry=await db.from("social_brand_assets").select("social_asset_id,name").eq("organization_id",brand.organization_id).eq("brand_id",brand.id).eq("asset_role","logo_primary").eq("is_active",true).order("created_at").limit(1).maybeSingle();
  if(registry.error)throw Error("Brand assets are unavailable. Retry before generating media.");
  if(!registry.data?.social_asset_id)blockers.push("Upload Limitless Realty's approved primary PNG logo.");
  else{
    const asset=await db.from("social_assets").select("id,status,mime_type,bucket_id,storage_path").eq("organization_id",brand.organization_id).eq("brand_id",brand.id).eq("id",registry.data.social_asset_id).maybeSingle();
    if(asset.error)throw Error("The logo asset could not be verified. Retry before generating media.");
    if(!asset.data||asset.data.status!=="ready"||asset.data.mime_type!=="image/png"||asset.data.bucket_id!=="flux-social-assets"||!String(asset.data.storage_path||"").startsWith(brand.organization_id+"/"))blockers.push("Restore a ready PNG logo belonging to this brand.");
    if(identity&&identity.logoAssetId!==registry.data.social_asset_id)blockers.push("The primary logo changed. Review and approve the visual identity again.");
  }
  return{ready:!blockers.length,blockers,identity,logoAssetId:registry.data?.social_asset_id as string|undefined};
}
