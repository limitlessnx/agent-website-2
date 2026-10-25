"use server";
import { revalidatePath } from "next/cache";
import { requireRealEstateAccess } from "@/lib/real-estate-access";
import { saveEstate, saveEstateFaq, deleteEstateFaq, assignPropertyToEstate, getEstate } from "@/lib/real-estate-catalog";
import { uploadPublicImage } from "@/lib/supabase-media";
import { approveEstateWebsiteSource, captureEstateWebsiteSource, linkEstateKnowledgeSource } from "@/lib/real-estate-knowledge";
import { fetchEstateWebsiteSnapshot } from "@/lib/real-estate-website";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import type { ActionResult } from "./ActionForm";
const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const estatePaths = () => { revalidatePath("/dashboard/real-estate"); revalidatePath("/dashboard/real-estate/estates", "layout"); revalidatePath("/dashboard/real-estate/properties"); revalidatePath("/dashboard/limitless/properties"); revalidatePath("/dashboard"); };
async function safeAction(run:()=>Promise<string>):Promise<ActionResult> {
  try { const message=await run(); estatePaths(); return {ok:true,message}; }
  catch(error) { return {ok:false,message:error instanceof Error?error.message:"The change could not be saved."}; }
}
export async function saveEstateAction(_previous:ActionResult, form:FormData):Promise<ActionResult> {
  return safeAction(async()=>{
    const scope=await requireRealEstateAccess("catalog.write");
    await requireRealEstateAccess("knowledge.write");
    const name=text(form,"name"); if(!name) throw new Error("Estate name is required.");
    const status=text(form,"status")||"draft"; const knowledgeStatus=text(form,"knowledge_status")||"draft";
    if(!["draft","published","archived"].includes(status)||!["draft","approved"].includes(knowledgeStatus)) throw new Error("Invalid estate or knowledge status.");
    const email=text(form,"contact_email");if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("A valid contact email is required.");
    await saveEstate(scope.organizationId,{id:text(form,"estate_id")||undefined,name,description:text(form,"description"),location:text(form,"location"),address:text(form,"address"),contact_name:text(form,"contact_name"),contact_email:email,contact_phone:text(form,"contact_phone"),status:status as "draft"|"published"|"archived",knowledge_status:knowledgeStatus as "draft"|"approved",payment_terms:text(form,"payment_terms"),terms_of_service:text(form,"terms_of_service"),operating_instructions:text(form,"operating_instructions")},scope.actorId);
    return "Estate saved. Approved knowledge is retrieved from live records; no code deployment is needed for content updates.";
  });
}
export async function saveEstateFaqAction(_previous:ActionResult,form:FormData):Promise<ActionResult>{
 return safeAction(async()=>{const scope=await requireRealEstateAccess("knowledge.write");const estateId=text(form,"estate_id");const question=text(form,"question"),answer=text(form,"answer");if(!question||!answer)throw new Error("Question and answer are both required.");const order=Number(text(form,"sort_order")||0);if(!Number.isInteger(order)||order<0||order>10000)throw new Error("FAQ order must be a non-negative whole number.");await saveEstateFaq(scope.organizationId,estateId,{id:text(form,"faq_id")||undefined,question,answer,category:text(form,"category"),sort_order:order},scope.actorId);return "FAQ saved. Review approved knowledge before publication.";});
}
export async function deleteEstateFaqAction(_previous:ActionResult,form:FormData):Promise<ActionResult>{
 return safeAction(async()=>{const scope=await requireRealEstateAccess("knowledge.write");if(text(form,"confirm_delete")!=="yes")throw new Error("Confirm FAQ deletion first.");const faqId=text(form,"faq_id");await deleteEstateFaq(scope.organizationId,text(form,"estate_id"),faqId,scope.actorId);return "FAQ deleted.";});
}
export async function assignPropertyEstateAction(_previous:ActionResult,form:FormData):Promise<ActionResult>{
 return safeAction(async()=>{const scope=await requireRealEstateAccess("catalog.write");const propertyId=text(form,"property_id");await assignPropertyToEstate(scope.organizationId,propertyId,text(form,"estate_id")||null,scope.actorId);return "Estate association saved. The original property listing has not been duplicated.";});
}
export async function saveEstateCoverAction(_previous:ActionResult,form:FormData):Promise<ActionResult>{
 return safeAction(async()=>{const scope=await requireRealEstateAccess("catalog.write");const estateId=text(form,"estate_id");const current=await getEstate(scope.organizationId,estateId);if(!current)throw new Error("Estate not found for this organization.");let cover:string|null=null;if(text(form,"remove_cover")!=="yes"){const file=form.get("cover_image");if(!(file instanceof File)||file.size===0)throw new Error("Choose an image or select remove cover.");const upload=await uploadPublicImage(file,{organizationKey:scope.organizationId+"-estate-"+estateId,organizationId:scope.organizationId});cover=upload.url;}await saveEstate(scope.organizationId,{id:estateId,name:current.estate.name,cover_image_url:cover},scope.actorId);return cover?"Cover image saved.":"Cover image removed from the estate profile. Stored media is retained for recovery.";});
}

export async function linkEstateKnowledgeAction(_previous:ActionResult,form:FormData):Promise<ActionResult>{
 return safeAction(async()=>{const scope=await requireRealEstateAccess("knowledge.write");const estateId=text(form,"estate_id"),sourceId=text(form,"knowledge_source_id");const remove=text(form,"remove_link")==="yes";await linkEstateKnowledgeSource(scope.organizationId,estateId,sourceId,scope.actorId,remove);return remove?"Knowledge source unlinked; its canonical document is retained.":"Canonical knowledge source linked to this estate.";});
}

export async function importEstateWebsiteAction(_previous:ActionResult,form:FormData):Promise<ActionResult>{
 return safeAction(async()=>{
  const scope=await requireRealEstateAccess("knowledge.write");
  if(text(form,"confirm_official_website")!=="yes")throw new Error("Confirm that this is an official public website page for the estate.");
  const estateId=text(form,"estate_id");
  const snapshot=await fetchEstateWebsiteSnapshot(text(form,"source_url"));
  const title=(text(form,"title")||snapshot.title||new URL(snapshot.url).hostname).slice(0,160);
  await captureEstateWebsiteSource(scope.organizationId,estateId,{title,url:snapshot.url,content:snapshot.content,checksum:snapshot.checksum},scope.actorId);
  return "Website snapshot captured as pending. Review the extracted text and approve it before Maia can use it.";
 });
}

export async function approveEstateWebsiteSourceAction(_previous:ActionResult,form:FormData):Promise<ActionResult>{
 return safeAction(async()=>{
  const scope=await requireRealEstateAccess("knowledge.write");
  if(text(form,"confirm_approval")!=="yes")throw new Error("Confirm that you reviewed and approve this website snapshot for Maia.");
  await approveEstateWebsiteSource(scope.organizationId,text(form,"estate_id"),text(form,"knowledge_source_id"),scope.actorId);
  return "Website snapshot approved. Maia can use it only when this estate is published and its knowledge status is approved.";
 });
}

export async function setInspectionAutomationAction(_previous:ActionResult,form:FormData):Promise<ActionResult>{
 try{
  const scope=await requireRealEstateAccess("appointments.write");
  const status=text(form,"status");
  if(status!=="enabled"&&status!=="paused")throw new Error("Choose whether inspection reminders are enabled or paused.");
  if(text(form,"confirm_change")!=="yes")throw new Error("Confirm this tenant's inspection reminder setting before saving.");
  if(status==="enabled")await assertFluxFeatureAccess(scope.organizationId,"reminders");
  const {error}=await createAdminClient().rpc("set_real_estate_inspection_automation",{p_organization_id:scope.organizationId,p_status:status,p_actor_id:scope.actorId,p_explicit_confirmation:true});
  if(error)throw error;
  revalidatePath("/dashboard/real-estate/operations");revalidatePath("/dashboard/real-estate");
  return{ok:true,message:status==="enabled"?"Inspection reminder automation enabled for this organization. The authenticated scheduler will process due opted-in jobs; delivery still depends on provider confirmation.":"Inspection reminder automation paused for this organization. Already claimed jobs may finish."};
 }catch(error){return{ok:false,message:error instanceof Error?error.message:"Could not change inspection reminder automation."};}
}
