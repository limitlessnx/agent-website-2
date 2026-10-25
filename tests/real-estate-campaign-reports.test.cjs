const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const root=path.resolve(__dirname,'..');
const reader=load(path.join(root,'lib/campaign-report-reader.ts'));
const A='b15f21b4-5697-4d21-9421-8a34eae3476d';
const B='7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4';

function parent(org,metadata={}) { return {id:`parent-${org}`,organization_id:org,outbound_kind:'campaign',idempotency_key:'campaign:req-1',campaign_id:'req-1',lifecycle_status:'executed',delivery_status:'accepted',metadata:{attempted:3,response:{campaignType:'market_update',topic:'Fixture update',templateName:'fixture_v1',executionId:'run-1',failed:1,skipped:0,...metadata}},created_at:'2026-10-24T10:00:00Z'}; }
function child(org,key,status,phone,id) { return {id:key,organization_id:org,outbound_kind:'campaign_recipient',idempotency_key:key,campaign_id:'req-1',recipient:phone,provider:'meta',provider_message_id:id,lifecycle_status:status==='delivered'?'received':'executed',delivery_status:status,created_at:'2026-10-24T10:01:00Z'}; }

test('campaign report projection filters parent and recipient rows by the explicit organization',()=>{
 const result=reader.projectCampaignReports(A,[parent(A),parent(B)],[child(A,'a1','delivered','2348030000001','wamid-a'),child(A,'a2','accepted','2348030000002','wamid-b'),child(B,'b1','read','2348030000003','wamid-c')],50);
 assert.equal(result.length,1);
 const report=result[0];
 assert.equal(report.id,'req-1');
 assert.equal(report.organization_id,A);
 assert.equal(report.campaign_topic,'Fixture update');
 assert.equal(report.attempted,3);
 assert.equal(report.accepted,2);
 assert.equal(report.sent,1);
 assert.equal(report.delivered,1);
 assert.equal(report.failed,1);
 assert.equal(report.pending_delivery,1);
 assert.equal(report.status,'partially_delivered');
 assert.equal(report.recipients.length,2);
 assert.equal(report.recipients[0].phone,'•••0001');
 assert.equal(report.recipients.some(item=>item.phone==='2348030000003'),false);
});

test('campaign report projection refuses missing tenant context and hides unscoped legacy rows',()=>{
 assert.throws(()=>reader.projectCampaignReports('',[parent(A)],[],50),/Organization ID is required/);
 assert.deepEqual(reader.projectCampaignReports(A,[{...parent(A),organization_id:null}],[],50),[]);
});

test('campaign report REST reads include the tenant filter for both campaign and recipient rows',async()=>{
 const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL='https://supabase.example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
 const calls=[];
 const api=load(path.join(root,'lib/campaign-report-reader.ts'),{},'',{fetch:async(url)=>{
  calls.push(String(url));
  if(String(url).includes('outbound_kind=eq.campaign&')) return {ok:true,json:async()=>[parent(A)]};
  return {ok:true,json:async()=>[child(A,'a1','delivered','2348030000001','wamid-a')]};
 }});
 try {
  const result=await api.getDetailedCampaignReports(A,10);
  assert.equal(result.length,1);
  assert.equal(calls.length,2);
  for(const url of calls) assert.match(url,/organization_id=eq\.b15f21b4-5697-4d21-9421-8a34eae3476d/);
  assert.ok(calls.every(url=>url.includes('real_estate_outbound_tracking')));
  assert.ok(calls.every(url=>!url.includes('bot_sessions')));
 } finally {
  if(oldUrl===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=oldUrl;
  if(oldKey===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
 }
});
