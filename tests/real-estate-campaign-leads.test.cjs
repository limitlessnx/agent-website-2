const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const servicePath=path.resolve(__dirname,'../lib/lead-profile-service.ts');
function service(rows){
 let requestedUrl='';let calls=0;
 const api=load(servicePath,{},'',{
  process:{env:{LIMITLESS_SUPABASE_URL:'https://supabase.invalid',LIMITLESS_SUPABASE_SERVICE_ROLE_KEY:'local-test-key'}},
  fetch:async(url)=>{calls++;requestedUrl=String(url);return{ok:true,status:200,json:async()=>rows,text:async()=>''};},
 });
 return{api,get url(){return requestedUrl;},get calls(){return calls;}};
}

test('campaign audience query is explicitly tenant-filtered and carries that scope into normalized leads',async()=>{
 const ORG='10000000-0000-4000-8000-000000000001';
 const client=service([{id:'lead-1',organization_id:ORG,name:'Newton',phone:'+234 801 234 5678',status:'new'},{id:'foreign',organization_id:'20000000-0000-4000-8000-000000000002',name:'Foreign',phone:'2348012345699'}]);
 const leads=await client.api.getCampaignAudienceLeads(ORG,100);
 assert.match(client.url,/organization_id=eq\.10000000-0000-4000-8000-000000000001/);
 assert.equal(leads[0].organization_id,ORG);
 assert.equal(leads[0].id,'lead-1');
 assert.equal(leads[0].phone,'2348012345678');
 assert.equal(leads.length,1);
});

test('missing database lead IDs remain missing and cannot be replaced with random IDs',async()=>{
 const ORG='10000000-0000-4000-8000-000000000001';
 const client=service([{organization_id:ORG,name:'Broken row',phone:'08012345678'}]);
 const first=await client.api.getCampaignAudienceLeads(ORG,100);
 const second=await client.api.getCampaignAudienceLeads(ORG,100);
 assert.equal(first[0].id,'');
 assert.equal(second[0].id,'');
});

test('empty organization scope fails before accessing the leads endpoint',async()=>{
 const client=service([]);
 await assert.rejects(client.api.getCampaignAudienceLeads('  '),/Organization ID is required/);
 assert.equal(client.calls,0);
});
