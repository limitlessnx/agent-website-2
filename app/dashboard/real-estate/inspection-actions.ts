"use server";
import { revalidatePath } from "next/cache";
import { requireRealEstateAccess } from "@/lib/real-estate-access";
import { approveRealEstateInspection,cancelRealEstateInspection,recordRealEstateInspectionOutcome,rescheduleRealEstateInspection,resolveLimitlessSourceSystemId } from "@/lib/real-estate-inspections";
import type { ActionResult } from "./ActionForm";
const text=(form:FormData,name:string)=>String(form.get(name)||"").trim();
async function run(action:()=>Promise<string>):Promise<ActionResult>{try{const message=await action();revalidatePath("/dashboard/real-estate/inspections");revalidatePath("/dashboard/real-estate/operations");return{ok:true,message};}catch(error){return{ok:false,message:error instanceof Error?error.message:"Inspection operation failed."};}}
export async function approveInspectionAction(_previous:ActionResult,form:FormData){return run(async()=>{
 const scope=await requireRealEstateAccess("appointments.write");if(text(form,"confirm_approval")!=="yes")throw new Error("Explicitly confirm the exact proposed booking before approval.");
 const sourceSystemId=await resolveLimitlessSourceSystemId(scope.organizationId);const result=await approveRealEstateInspection({organizationId:scope.organizationId,inspectionId:text(form,"inspection_id"),approvedBy:scope.actorId,sourceSystemId,propertyId:text(form,"property_id"),requestedStartAt:text(form,"requested_start_at"),requestedResourceId:text(form,"calendar_resource_id")||null});
 return result.status==="unavailable"?`Not booked: ${result.inspection.unavailable_reason||"No suitable calendar resource is available."}`:"Approval recorded. Booking is pending until the canonical calendar provider confirms its event.";
});}
export async function changeInspectionAction(_previous:ActionResult,form:FormData){return run(async()=>{
 const scope=await requireRealEstateAccess("appointments.write");if(text(form,"confirm_change")!=="yes")throw new Error("Explicit confirmation is required for this change.");
 const organizationId=scope.organizationId,inspectionId=text(form,"inspection_id"),action=text(form,"inspection_action"),notes=text(form,"notes");
 if(action==="completed"||action==="no_show"){await recordRealEstateInspectionOutcome({organizationId,inspectionId,outcome:action,notes,actorId:scope.actorId});return"Inspection outcome recorded; the persisted follow-up job remains subject to entitlement and contact-policy checks.";}
 if(action==="rescheduled"){const result=await rescheduleRealEstateInspection({organizationId,inspectionId,sourceSystemId:await resolveLimitlessSourceSystemId(organizationId),requestedStartAt:text(form,"requested_start_at"),timezone:text(form,"timezone")||null,reason:notes,actorId:scope.actorId});return`${result.status}: awaiting the verified calendar reschedule.`;}
 if(action==="cancelled"){const result=await cancelRealEstateInspection({organizationId,inspectionId,sourceSystemId:await resolveLimitlessSourceSystemId(organizationId),reason:notes,actorId:scope.actorId});return`${result.status}: old reminders are stopped and any calendar cancellation awaits its provider event.`;}
 throw new Error("Invalid inspection action.");
});}
