import { createAdminClient } from "@/lib/supabase/admin";
export type RealEstateProvider = "meta" | "twilio";
export type RealEstateReceiptStatus = "accepted" | "sent" | "delivered" | "read" | "failed";
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
export async function syncRealEstateProviderStatus(input:{provider:RealEstateProvider;providerMessageId:string;status:RealEstateReceiptStatus;eventAt?:string|null;organizationId?:string|null;errorCode?:string|null;errorMessage?:string|null}){
 const providerMessageId=String(input.providerMessageId||"").trim();
 if(!providerMessageId||providerMessageId.length>512)throw new Error("A valid provider message ID is required.");
 const eventAt=input.eventAt&&Number.isFinite(new Date(input.eventAt).getTime())?new Date(input.eventAt).toISOString():new Date().toISOString();
 const {data,error}=await (createAdminClient() as unknown as RpcClient).rpc("apply_real_estate_delivery_receipt",{
  p_provider:input.provider,p_provider_message_id:providerMessageId,p_delivery_status:input.status,p_event_at:eventAt,
  p_organization_id:input.organizationId||null,p_error_code:input.errorCode?String(input.errorCode).slice(0,100):null,
  p_error_message:input.errorMessage?String(input.errorMessage).slice(0,1000):null,
 });
 if(error)throw error;
 const row=Array.isArray(data)?data[0]:data;
 return row&&typeof row==="object"&&!Array.isArray(row)?row:{applied:false,organization_id:null,delivery_status:null,event_status:"unmatched"};
}
