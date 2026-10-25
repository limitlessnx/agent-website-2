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

test('24-hour direct window includes its exact expiry boundary and rejects future/invalid/stale events',()=>{
 const now=Date.parse('2026-10-24T12:00:00Z');
 assert.equal(api.isWithinCustomerServiceWindow('2026-10-23T12:00:00Z',now),true);
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
