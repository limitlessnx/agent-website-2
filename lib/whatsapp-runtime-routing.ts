import { createAdminClient } from "@/lib/supabase/admin";

export async function resolveWhatsAppRuntimeTarget(organizationId:string){
  const admin=createAdminClient();
  const {data:integration,error:integrationError}=await admin
    .from("organization_integrations")
    .select("configuration,status")
    .eq("organization_id",organizationId)
    .in("provider",["whatsapp","meta_whatsapp"])
    .in("status",["configured","connected","degraded"])
    .limit(1)
    .maybeSingle();
  if(integrationError) throw integrationError;
  if(!integration) return null;

  const config=(integration.configuration||{}) as Record<string,unknown>;
  if(config.maia_active===true){
    const {data:agent,error}=await admin.from("agents")
      .select("id")
      .eq("organization_id",organizationId)
      .eq("slug","maia")
      .in("status",["published","active"])
      .limit(1)
      .maybeSingle();
    if(error) throw error;
    return agent?.id
      ?{organizationId,agentId:String(agent.id),mode:"maia" as const,sourceSystemId:null}
      :null;
  }

  const {data:catalog,error:catalogError}=await admin.from("system_catalog")
    .select("id")
    .eq("slug","whatsapp-agent")
    .eq("status","available")
    .maybeSingle();
  if(catalogError) throw catalogError;
  if(!catalog?.id) return null;

  const {data:installation,error:installationError}=await admin.from("organization_systems")
    .select("id")
    .eq("organization_id",organizationId)
    .eq("system_id",catalog.id)
    .eq("status","active")
    .maybeSingle();
  if(installationError) throw installationError;
  if(!installation?.id) return null;

  const {data:selections,error:selectionError}=await admin.from("organization_agent_selections")
    .select("configuration,status")
    .eq("organization_id",organizationId)
    .eq("system_catalog_id",catalog.id)
    .in("status",["active","selected","paid","provisioning"]);
  if(selectionError) throw selectionError;

  const selected=(selections||[]).find((row)=>
    Boolean(((row.configuration||{}) as Record<string,unknown>).provisioned_agent_id)
  );
  const agentId=selected
    ?String(((selected.configuration||{}) as Record<string,unknown>).provisioned_agent_id||"")
    :"";
  return agentId
    ?{organizationId,agentId,mode:"modular" as const,sourceSystemId:String(installation.id)}
    :null;
}
