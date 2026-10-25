const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const load=require('./helpers/load-typescript.cjs');
const calls=[];
const service=load('lib/real-estate-provider-status.ts',{
 '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{calls.push([name,args]);return{data:[{applied:true,event_status:'applied'}],error:null};}})},
});

test('provider receipt helper validates ID and forwards tenant/provider/state to one atomic RPC',async()=>{
 calls.length=0;
 const result=await service.syncRealEstateProviderStatus({provider:'twilio',providerMessageId:'SM-fictional',status:'delivered',eventAt:'2026-10-24T09:15:00Z',organizationId:'b15f21b4-5697-4d21-9421-8a34eae3476d',errorCode:null,errorMessage:null});
 assert.equal(result.event_status,'applied');assert.equal(calls.length,1);assert.equal(calls[0][0],'apply_real_estate_delivery_receipt');
 assert.equal(calls[0][1].p_provider,'twilio');assert.equal(calls[0][1].p_provider_message_id,'SM-fictional');
 assert.equal(calls[0][1].p_organization_id,'b15f21b4-5697-4d21-9421-8a34eae3476d');assert.equal(calls[0][1].p_delivery_status,'delivered');
});

test('provider receipt helper rejects invalid IDs before database access',async()=>{
 calls.length=0;await assert.rejects(service.syncRealEstateProviderStatus({provider:'meta',providerMessageId:' ',status:'read'}),/provider message ID/);assert.equal(calls.length,0);
});

test('Meta and Twilio integrations reconcile only after provider signature validation and bind the verified organization',()=>{
 const meta=fs.readFileSync('app/api/whatsapp/webhook/route.ts','utf8');
 const twilio=fs.readFileSync('app/api/whatsapp/twilio/status/route.ts','utf8');
 assert.ok(meta.indexOf('if (!signatureValid)')<meta.indexOf('await syncRealEstateProviderStatus'));
 assert.ok(twilio.indexOf('if(!validateTwilioFormSignature')<twilio.indexOf('await syncRealEstateProviderStatus'));
 assert.ok(meta.indexOf('tenant = phoneNumberId ? await resolveWhatsAppTenant(phoneNumberId)')<meta.indexOf('for (const status of recordArray(value.statuses))'));
 assert.match(meta,/organizationId:String\(tenant\?\.organizationId\|\|""\)/);
 assert.match(meta,/syncHandoffNotificationStatus\(/);
 assert.ok(twilio.indexOf('if(!validateTwilioFormSignature')<twilio.indexOf('await syncHandoffNotificationStatus'));
 assert.match(twilio,/organizationId:String\(binding\.organization_id\)/);
 assert.match(twilio,/errorCode:String\(params\.get\("ErrorCode"\)/);
});
