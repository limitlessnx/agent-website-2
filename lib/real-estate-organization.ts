import type { SupabaseClient } from "@supabase/supabase-js";
export type RealEstateOrganization={id:string;name:string;slug:string;status:string;metadata:Record<string,unknown>};
export function isRealEstateOrganizationRecord(input:{slug?:string|null;metadata?:unknown;status?:string|null}):boolean{
 if(input.status&&input.status!=="active")return false;if(input.slug==="limitless-realty")return true;
 const metadata=input.metadata&&typeof input.metadata==="object"?input.metadata as Record<string,unknown>:{};
 const industry=String(metadata.industry_slug||metadata.industry||"").toLowerCase().replace(/[^a-z]/g,"");return industry==="realestate";
}
export async function resolveActiveRealEstateOrganization(client:Pick<SupabaseClient,"from">,organizationId:string):Promise<RealEstateOrganization|null>{
 const id=organizationId.trim();if(!id)throw new Error("An explicit organization is required.");
 const {data,error}=await client.from("organizations").select("id,name,slug,status,metadata").eq("id",id).maybeSingle();if(error)throw error;if(!data||!isRealEstateOrganizationRecord(data))return null;
 return {id:String(data.id),name:String(data.name||"Real-estate organization"),slug:String(data.slug||id),status:String(data.status),metadata:(data.metadata||{}) as Record<string,unknown>};
}
