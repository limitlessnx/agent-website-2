import { createAdminClient } from "@/lib/supabase/admin";
export type EstateKnowledgeSource={id:string;title:string;source_type:string;source_url:string|null;content:string|null;status:string;updated_at:string};
export async function listEstateKnowledgeSources(organizationId:string,estateId:string,approvedOnly=false){
 if(!organizationId||!estateId)throw new Error("Organization and estate are required.");
 const admin=createAdminClient();const links=await admin.from("real_estate_estate_knowledge_links").select("knowledge_source_id").eq("organization_id",organizationId).eq("estate_id",estateId).limit(200);if(links.error)throw links.error;
 const ids=(links.data||[]).map(row=>row.knowledge_source_id);if(!ids.length)return[];
 let query=admin.from("knowledge_sources").select("id,title,source_type,source_url,content,status,updated_at").eq("organization_id",organizationId).in("id",ids).order("updated_at",{ascending:false}).limit(200);
 if(approvedOnly)query=query.eq("status","ready");const result=await query;if(result.error)throw result.error;return(result.data||[])as EstateKnowledgeSource[];
}
export async function linkEstateKnowledgeSource(organizationId:string,estateId:string,sourceId:string,actorId:string,remove=false){
 if(!organizationId||!estateId||!sourceId||!actorId?.trim())throw new Error("Organization, estate, source and authenticated actor are required.");
 const result=await createAdminClient().rpc("link_real_estate_knowledge_source_with_audit",{p_organization_id:organizationId,p_actor_id:actorId,p_estate_id:estateId,p_knowledge_source_id:sourceId,p_remove:remove});
 if(result.error)throw result.error;return {linked:!remove};
}
