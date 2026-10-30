const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const load=require('./helpers/load-typescript.cjs');
const api=load(path.resolve(__dirname,'../lib/real-estate-customer-service-window.ts'),{
 '@/lib/supabase/admin':{createAdminClient:()=>({})},
 '@/lib/lead-profile-service':{normalizeLeadPhone:(value)=>String(value||'').replace(/\D/g,'')},
 '@/lib/real-estate-organization':{resolveActiveRealEstateOrganization:async()=>null},
});

test('parses Meta seconds, millisecond epochs and ISO timestamps without timezone guessing',()=>{
 assert.equal(api.parseInboundTimestamp('1700000000'),'2023-11-14T22:13:20.000Z');
 assert.equal(api.parseInboundTimestamp('1700000000000'),'2023-11-14T22:13:20.000Z');
 assert.equal(api.parseInboundTimestamp('2026-10-24T12:00:00Z'),'2026-10-24T12:00:00.000Z');
});

test('invalid or implausibly future provider timestamps fall back to server receipt time',()=>{
 const receivedAt=Date.parse('2026-10-24T12:00:00Z');
 assert.equal(api.parseInboundTimestamp('not-a-date',receivedAt),'2026-10-24T12:00:00.000Z');
 assert.equal(api.parseInboundTimestamp('2026-10-25T12:00:00Z',receivedAt),'2026-10-24T12:00:00.000Z');
});

test('24-hour direct window excludes its exact expiry boundary and rejects future/invalid/stale events',()=>{
 const now=Date.parse('2026-10-24T12:00:00Z');
 assert.equal(api.isWithinCustomerServiceWindow('2026-10-23T12:00:00Z',now),false);
 assert.equal(api.isWithinCustomerServiceWindow('2026-10-23T12:00:00.001Z',now),true);
 assert.equal(api.isWithinCustomerServiceWindow('2026-10-23T11:59:59.999Z',now),false);
 assert.equal(api.isWithinCustomerServiceWindow('2026-10-24T12:00:01Z',now),false);
 assert.equal(api.isWithinCustomerServiceWindow('invalid',now),false);
});

test('inbound worker records only Meta timestamps in a non-blocking optional projection',()=>{
 const sources=['tenant-channel-runtime.ts','maia-runtime.ts'].map((file)=>fs.readFileSync(path.resolve(__dirname,`../src/trigger/${file}`),'utf8'));
 for(const source of sources){
  assert.match(source,/recordRealEstateCustomerInboundWindow\(/);
  assert.match(source,/providerMessageId:\s*payload\.externalEventId/);
  assert.match(source,/occurredAt:\s*payload\.metadata\?\.timestamp/);
 }
 assert.match(sources[0],/optional projection must never interrupt inbound conversation handling/);
 assert.match(sources[1],/logger\.warn\("Unable to record real-estate customer-service window"/);
});

test('direct-window reads split large audiences into bounded parallel batches',async()=>{
 const sizes=[];
 const now=Date.now();
 const admin={from:()=>({select(){return this;},eq(){return this;},in(_column,values){sizes.push(values.length);return Promise.resolve({data:values.map((phone_normalized)=>({phone_normalized,last_inbound_at:new Date(now-1000).toISOString()})),error:null});}})};
 const reader=load(path.resolve(__dirname,'../lib/real-estate-customer-service-window.ts'),{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/lead-profile-service':{normalizeLeadPhone:(value)=>String(value||'').replace(/\D/g,'')},
  '@/lib/real-estate-organization':{resolveActiveRealEstateOrganization:async(_client,id)=>({id,slug:'limitless-realty',status:'active',metadata:{}})},
 });
 const phones=Array.from({length:251},(_,index)=>String(23400000000000+index));
 const result=await reader.getRealEstateDirectWindowPhones('org-1',phones,now);
 assert.deepEqual(sizes,[100,100,51]);
 assert.equal(result.size,251);
});

test('a window lookup error propagates so callers cannot send from uncertain eligibility',async()=>{
 const admin={from:()=>({select(){return this;},eq(){return this;},in(){return Promise.resolve({data:null,error:new Error('database offline')});}})};
 const reader=load(path.resolve(__dirname,'../lib/real-estate-customer-service-window.ts'),{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/lead-profile-service':{normalizeLeadPhone:(value)=>String(value||'').replace(/\D/g,'')},
  '@/lib/real-estate-organization':{resolveActiveRealEstateOrganization:async(_client,id)=>({id,slug:'limitless-realty',status:'active',metadata:{}})},
 });
 await assert.rejects(reader.getRealEstateDirectWindowPhones('org-1',['2348012345678']),/database offline/);
});

test('Limitless strict template validation blocks missing or mismatched required values before Meta delivery',async()=>{
 const route=fs.readFileSync(path.resolve(__dirname,'../app/api/limitless/maia/followups/route.ts'),'utf8');
 const orderMatch=route.match(/const LIMITLESS_APPROVED_FOLLOWUP_VARIABLE_ORDER = \[([\s\S]*?)\] as const;/);
 assert.ok(orderMatch,'the Limitless route must declare its approved variable order');
 const order=Array.from(orderMatch[1].matchAll(/"([^"]+)"/g),match=>match[1]);
 const validValues=Object.fromEntries(order.map(key=>[key,`sample-${key}`]));

 function createClient(template){
  const calls=[];
  const admin={
   from:()=>({select(){return this;},eq(){return this;},in(){return this;},limit(){return this;},maybeSingle:async()=>({data:{id:'unit-integration',status:'connected',configuration:{provider_family:'meta'}},error:null})}),
   rpc:async()=>({data:{provider_family:'meta',phone_number_id:'unit-phone-id',access_token:'unit-test-token',graph_version:'v23.0'},error:null}),
  };
  const fetch=async(url,init={})=>{
   calls.push({url:String(url),init});
   const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body,text:async()=>JSON.stringify(body)});
   if(String(url).includes('/rest/v1/whatsapp_template_configs?')) return response([template]);
   if(String(url).startsWith('https://graph.facebook.com/')) return response({messages:[{id:'unit-provider-message'}]});
   if(String(url).includes('/rest/v1/whatsapp_delivery_attempts')) return response([],201);
   throw new Error('Unexpected network request in test');
  };
  const client=load(path.resolve(__dirname,'../lib/whatsapp-delivery.ts'),{
   '@/lib/supabase/admin':{createAdminClient:()=>admin},
   '@/lib/twilio-whatsapp':{sendTwilioWhatsAppMessage:async()=>({sid:'unit-provider-message'})},
  },'',{fetch,process:{env:{LIMITLESS_SUPABASE_URL:'https://unit.test',LIMITLESS_SUPABASE_SERVICE_ROLE_KEY:'unit-test-key'}}});
  return {client,calls};
 }

 const input={
  organizationId:'b15f21b4-5697-4d21-9421-8a34eae3476d',
  to:'2348012345678',
  text:'Unit test only',
  deliveryMode:'template',
  templatePurpose:'follow_up_outside_24h',
  strictTemplateContract:{approvedVariableOrder:order},
  variables:validValues,
 };
 const base={template_name:'unit_test_template',language_code:'en',variable_keys:order,status:'active',metadata:{approved_variable_order:order}};

 for(const invalid of [
  {...base,metadata:{}},
  {...base,metadata:{approved_variable_order:[...order].reverse()}},
 ]){
  const {client,calls}=createClient(invalid);
  await assert.rejects(client.sendWhatsAppMessage(input),/template variable contract|variable order/i);
  assert.equal(calls.some(call=>call.url.startsWith('https://graph.facebook.com/')),false);
 }

 const blank={...validValues,[order[0]]:'   '};
 const missingValueClient=createClient(base);
 await assert.rejects(missingValueClient.client.sendWhatsAppMessage({...input,variables:blank}),/required approved WhatsApp template variable/i);
 assert.equal(missingValueClient.calls.some(call=>call.url.startsWith('https://graph.facebook.com/')),false);

 const validClient=createClient(base);
 const result=await validClient.client.sendWhatsAppMessage(input);
 assert.equal(result.ok,true);
 assert.equal(validClient.calls.filter(call=>call.url.startsWith('https://graph.facebook.com/')).length,1);

 const directClient=createClient(base);
 const directResult=await directClient.client.sendWhatsAppMessage({
  organizationId:input.organizationId,
  to:input.to,
  text:'Verified service-window reply',
  deliveryMode:'direct',
  lastCustomerMessageAt:new Date(Date.now()-60_000).toISOString(),
 });
 assert.equal(directResult.messageType,'text');
 assert.equal(directClient.calls.some(call=>call.url.includes('whatsapp_template_configs?')),false);
 const directPayload=directClient.calls.find(call=>call.url.startsWith('https://graph.facebook.com/'));
 assert.equal(JSON.parse(directPayload.init.body).type,'text');
});

test('single-phone direct-window lookup returns the verified stored inbound timestamp only while the window is open',async()=>{
 const now=Date.parse('2026-10-24T12:00:00Z');
 const lastInboundAt='2026-10-24T11:59:00.000Z';
 const filters={};
 const admin={from:()=>({
  select(){return this;},
  eq(key,value){filters[key]=value;return this;},
  order(){return this;},
  limit(){return this;},
  maybeSingle:async()=>({data:{phone_normalized:'2348012345678',last_inbound_at:lastInboundAt},error:null}),
 })};
 const reader=load(path.resolve(__dirname,'../lib/real-estate-customer-service-window.ts'),{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/lead-profile-service':{normalizeLeadPhone:(value)=>String(value||'').replace(/\D/g,'')},
  '@/lib/real-estate-organization':{resolveActiveRealEstateOrganization:async(_client,id)=>({id,slug:'limitless-realty',status:'active',metadata:{}})},
 });
 const result=await reader.getRealEstateDirectWindowLastInboundAt('org-1','+234 801 234 5678',now);
 assert.equal(result,lastInboundAt);
 assert.equal(filters.organization_id,'org-1');
 assert.equal(filters.provider,'meta_whatsapp');
 assert.equal(filters.phone_normalized,'2348012345678');
});
