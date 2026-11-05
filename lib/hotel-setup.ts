import {getClientSession} from "@/lib/client-auth";
import {requirePortalPermission} from "@/lib/portal-access";
import {requireHotelOrganization} from "@/lib/hotel-communications";
import {createAdminClient} from "@/lib/supabase/admin";
import {HotelWorkspaceError} from "@/lib/hotel-booking-service";
import {HOTEL_SETUP_FIELDS,hotelSetupValues,type HotelSetupData,type HotelSetupValues} from "@/lib/hotel-setup-contract";
export async function hotelSetupAccess(write=false){
  const session=await getClientSession();if(!session)throw new HotelWorkspaceError("Sign in to this workspace.",401);
  try{
    if(write&&session.isAdminPreview)throw Error();
    const access=session.isAdminPreview?{permissions:new Set(["customers.view"])}:await requirePortalPermission(session,write?["organization.manage"]:["organization.manage","organization.view","customers.view","customers.manage"]);
    await requireHotelOrganization(session.organizationId);return {session,permissions:access.permissions};
  }catch{throw new HotelWorkspaceError("Hotel setup permission required.",403);}
}
function check(error:unknown){if(error)throw new HotelWorkspaceError("Hotel setup could not be loaded. Try again.",503);}
export async function loadHotelSetup(org:string,permissions:Set<string>,preview=false):Promise<HotelSetupData>{
  const admin=createAdminClient(),canViewIntegrations=!preview&&(permissions.has("integrations.view")||permissions.has("integrations.manage")),canViewTeam=!preview&&(permissions.has("members.view")||permissions.has("members.manage"));
  const [settings,profile]=await Promise.all([admin.from("hotel_settings").select("values,revision,updated_at").eq("organization_id",org).maybeSingle(),admin.from("client_onboarding_profiles").select("business_name,business_email,phone,country,timezone,human_contact_name,human_contact_email").eq("organization_id",org).maybeSingle()]);
  check(settings.error);check(profile.error);
  const defaults=Object.fromEntries(Object.keys(HOTEL_SETUP_FIELDS).map(key=>[key,""])) as HotelSetupValues;
  const values={...defaults,...Object.fromEntries(Object.entries(profile.data||{}).filter(([key])=>key in defaults).map(([key,value])=>[key,typeof value==="string"?value:""])),escalation_name:profile.data?.human_contact_name||"",escalation_email:profile.data?.human_contact_email||"",...(settings.data?.values||{})} as HotelSetupValues;
  const checks:HotelSetupData["checks"]=[{key:"profile",label:"Hotel information",state:values.business_name&&values.address&&values.timezone&&values.currency?"ready":"attention",detail:"Name, address, time zone and default currency."},{key:"policies",label:"Guest policies",state:values.check_in&&values.check_out&&values.cancellation_policy&&values.inclusions?"ready":"attention",detail:"Check-in/out, cancellation terms and inclusions shared with guests."},{key:"escalation",label:"Escalation contact",state:values.escalation_name&&(values.escalation_email||values.escalation_phone)?"ready":"attention",detail:"Private contact details. Configure actual handoff assignments in Settings.",href:"/portal/settings"}];
  if(canViewIntegrations){
    const [integration,binding,agents,templates]=await Promise.all([
      admin.from("organization_integrations").select("status,last_checked_at,health").eq("organization_id",org).in("provider",["whatsapp","meta_whatsapp"]).limit(1).maybeSingle(),
      admin.from("whatsapp_twilio_bindings").select("status,twilio_sender_status").eq("organization_id",org).maybeSingle(),
      admin.from("agents").select("id,status,communication_channels").eq("organization_id",org),
      admin.from("whatsapp_template_configs").select("purpose,metadata,status").eq("organization_id",org).eq("status","active"),
    ]);for(const result of [integration,binding,agents,templates])check(result.error);
    const health=integration.data?.health as {ready_for_cutover?:boolean}|null;
    const checked=Date.parse(integration.data?.last_checked_at||""),fresh=Number.isFinite(checked)&&Date.now()-checked<86400000&&Date.now()>=checked;
    checks.push({key:"whatsapp",label:"WhatsApp connection",state:integration.data?.status==="connected"&&health?.ready_for_cutover&&fresh?"ready":"unverified",detail:`Saved provider check${integration.data?.last_checked_at?` from ${integration.data.last_checked_at}`:" not available"}. Sender: ${binding.data?.twilio_sender_status||binding.data?.status||"not registered"}. This does not prove message delivery.`,href:"/portal/integrations"});
    const active=(agents.data||[]).filter(agent=>agent.status==="active"&&Array.isArray(agent.communication_channels)&&agent.communication_channels.includes("whatsapp"));
    checks.push({key:"agent",label:"WhatsApp agent",state:active.length===1?"ready":"attention",detail:`${active.length} active WhatsApp agents. Review routing and instructions before testing.`,href:"/portal/agents"});
    const approved=(templates.data||[]).filter(row=>String(row.purpose).startsWith("hotel_")&&(row.metadata as {provider_status?:string}|null)?.provider_status==="approved");
    checks.push({key:"templates",label:"Approved hotel templates",state:approved.length?"ready":"attention",detail:`${approved.length} active hotel templates recorded as provider-approved. Each campaign still validates its exact purpose and variables. Outside 24 hours an approved matching template is required.`,href:"/portal/campaigns"});
  }else checks.push({key:"whatsapp",label:"WhatsApp readiness",state:"unverified",detail:"Ask an authorized integrations manager to review the connection, agent and approved templates."});
  checks.push({key:"live_test",label:"Guest journey test",state:"unverified",detail:"Use an authorized test number to check inbound questions, room availability, replies and human handoff. No live message has been sent by this checklist."});
  return {values,revision:settings.data?.revision||0,updated_at:settings.data?.updated_at,canManage:!preview&&permissions.has("organization.manage"),canViewIntegrations,canManageIntegrations:!preview&&permissions.has("integrations.manage"),canViewTeam,checks};
}
export async function saveHotelSetup(org:string,actor:string,body:Record<string,unknown>){
  if(!Number.isInteger(body.revision)||Number(body.revision)<0)throw new HotelWorkspaceError("Reload the latest hotel settings.");
  let values:HotelSetupValues;try{values=hotelSetupValues(body.values);}catch(error){throw new HotelWorkspaceError(error instanceof Error?error.message:"Check hotel settings.");}
  const result=await createAdminClient().rpc("hotel_save_settings",{p_organization_id:org,p_actor:actor,p_revision:body.revision,p_values:values});
  if(result.error)throw new HotelWorkspaceError(result.error.code==="P0001"?"These settings changed. Reload before saving.":"Hotel settings could not be saved.",result.error.code==="P0001"?409:503);
  return result.data;
}
