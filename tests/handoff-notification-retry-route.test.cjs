const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');

function setup({session={userId:'user-1',organizationId:'org-1',membershipId:'member-1'},prepare=async()=>({approvalId:'approval-1',recipientPreview:'••••0000',message:'Exact message',expiresAt:'2030-01-01T00:02:00Z'}),confirm=async()=>({notificationId:'notification-1',status:'sent',retryCount:1})}={}){
 const calls=[];
 const route=load(path.resolve(__dirname,'../app/api/portal/handoffs/[id]/retry/route.ts'),{
  'next/server':{NextResponse:{json:(body,init={})=>({status:init.status||200,body})}},
  '@/lib/client-auth':{getClientSession:async()=>session},
  '@/lib/handoff-notification-retry':{
   prepareFailedHumanHandoffNotificationRetry:async(...args)=>{calls.push(['prepare',...args]);return prepare(...args);},
   confirmFailedHumanHandoffNotificationRetry:async(...args)=>{calls.push(['confirm',...args]);return confirm(...args);},
  },
 });
 return{route,calls};
}
const params={params:Promise.resolve({id:'handoff-1'})};
const request=(body)=>({json:async()=>body});

test('retry preview requires a signed-in user and makes no provider confirmation call',async()=>{
 const {route,calls}=setup({});
 const result=await route.POST(request({action:'prepare',notificationId:'notification-1'}),params);
 assert.equal(result.status,200);
 assert.equal(result.body.preview.message,'Exact message');
 assert.deepEqual(calls.map((call)=>call[0]),['prepare']);
});

test('confirmation requires the one-time approval returned by the exact preview',async()=>{
 const {route,calls}=setup();
 const result=await route.POST(request({action:'confirm',notificationId:'notification-1',approvalId:'approval-1'}),params);
 assert.equal(result.status,200);
 assert.equal(result.body.result.status,'sent');
 assert.deepEqual(calls.map((call)=>call[0]),['confirm']);
 assert.equal(calls[0][4],'approval-1');
});

test('confirmation without an approval and unsupported actions do not call the service',async()=>{
 const {route,calls}=setup();
 const missing=await route.POST(request({action:'confirm',notificationId:'notification-1'}),params);
 const unsupported=await route.POST(request({action:'retry',notificationId:'notification-1'}),params);
 assert.equal(missing.status,400);assert.equal(unsupported.status,400);assert.equal(calls.length,0);
});

test('unauthenticated requests cannot prepare or confirm retries',async()=>{
 const {route,calls}=setup({session:null});
 const result=await route.POST(request({action:'confirm',notificationId:'notification-1',approvalId:'approval-1'}),params);
 assert.equal(result.status,401);assert.equal(calls.length,0);
});
