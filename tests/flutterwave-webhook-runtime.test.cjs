const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');

function setup({claim='claimed',signature=true,verifyError=false,complete=true,paymentOverrides={},ambiguous=false}={}) {
  const calls=[];
  const subscription={id:'sub',plan_id:'plan',provider_subscription_id:'provider-1',status:'active',metadata:{provider_customer_email:'client@example.com',flutterwave_payment_plan_id:'flw-plan'}};
  const rest=async(url,init={})=>{
    const body=init.body?JSON.parse(init.body):null; calls.push({url,body});
    if(url==='rpc/claim_flutterwave_webhook')return {id:'event',state:claim};
    if(url.startsWith('checkout_sessions?'))return [];
    if(url.startsWith('organization_subscriptions?'))return ambiguous?[subscription,subscription]:[subscription];
    if(url.startsWith('billing_plans?'))return [{id:'plan',currency:'NGN',recurring_fee:100}];
    if(url==='rpc/apply_flutterwave_renewal')return {renewed:true};
    if(url==='rpc/cancel_flutterwave_subscription')return {cancelled:true};
    if(url.startsWith('payment_webhook_events?'))return complete?[{id:'event'}]:[];
    throw new Error('Unexpected REST '+url);
  };
  const provider=async(url)=>{
    if(verifyError)throw new Error('provider unavailable');
    if(url.startsWith('/transactions/'))return {data:{id:1,tx_ref:'tx',status:'successful',currency:'NGN',amount:100,created_at:'2028-01-31T12:00:00Z',customer:{email:'client@example.com'},...paymentOverrides}};
    return {data:[{id:'provider-1',amount:100,plan:'flw-plan',customer:{email:'client@example.com'}}]};
  };
  const route=load(path.resolve(__dirname,'../app/api/webhooks/flutterwave/route.ts'),{
    'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:init.headers})}},
    '@/lib/supabase-server-rest':{supabaseRest:rest},
    '@/lib/payments/flutterwave':{flutterwaveRequest:provider,isValidFlutterwaveWebhook:()=>signature},
    '@/lib/payments/activate-paid-trial':{activatePaidTrialSubscription:async()=>{throw new Error('unexpected activation');}},
  },'',{console:{error:()=>{}}});
  const post=(event={event:'charge.completed',data:{id:1,tx_ref:'tx',currency:'NGN'}})=>route.POST({text:async()=>typeof event==='string'?event:JSON.stringify(event),headers:{}});
  return {post,calls};
}

test('invalid signatures and JSON cannot claim events',async()=>{
  const invalid=setup({signature:false});assert.equal((await invalid.post()).status,401);assert.equal(invalid.calls.length,0);
  const malformed=setup();assert.equal((await malformed.post('{')).status,400);assert.equal(malformed.calls.length,0);
  assert.equal((await malformed.post('null')).status,400);
});
test('busy deliveries ask for retry and processed deliveries are acknowledged without work',async()=>{
  for(const state of ['busy','processed']){
    const {post,calls}=setup({claim:state});const response=await post();
    assert.equal(response.status,state==='busy'?503:200);assert.equal(calls.length,1);
    if(state==='busy')assert.equal(response.headers['Retry-After'],'10');
  }
});
test('verified renewals pass stable provider identity and claim ownership into the atomic RPC',async()=>{
  const {post,calls}=setup();assert.equal((await post()).status,200);
  const claim=calls[0].body;
  const renewal=calls.find(c=>c.url==='rpc/apply_flutterwave_renewal').body;
  assert.equal(renewal.claim_token,claim.claim_token);assert.equal(renewal.target_event_id,'event');
  assert.equal(renewal.transaction_id,'1');assert.equal(renewal.expected_provider_subscription_id,'provider-1');
  assert.equal(renewal.paid_at,'2028-01-31T12:00:00Z');
  const completion=calls.at(-1);assert.ok(completion.url.includes(`processing_token=eq.${claim.claim_token}`));assert.equal(completion.body.processing_token,null);
  assert.equal(calls.filter(c=>c.url.startsWith('organization_subscriptions?')&&c.body).length,0);
});
test('provider failures release only the owned claim and return a retriable error',async()=>{
  const {post,calls}=setup({verifyError:true});assert.equal((await post()).status,500);
  assert.ok(calls.at(-1).url.includes(`processing_token=eq.${calls[0].body.claim_token}`));
  assert.equal(calls.at(-1).body.processing_token,null);
  assert.ok(calls.at(-1).body.processing_error);
});
test('a stale worker cannot report success after completion ownership is lost',async()=>{
  const {post}=setup({complete:false});assert.equal((await post()).status,500);
});
test('wrong transaction, currency or ambiguous tenant never applies a renewal',async()=>{
  for(const options of [{paymentOverrides:{id:2}},{paymentOverrides:{currency:'USD'}},{ambiguous:true}]){
    const {post,calls}=setup(options);assert.equal((await post()).status,500);
    assert.equal(calls.some(c=>c.url==='rpc/apply_flutterwave_renewal'),false);
  }
});
test('cancellations use the fenced atomic cancellation RPC',async()=>{
  const {post,calls}=setup();
  const response=await post({event:'subscription.cancelled',data:{customer:{email:'client@example.com'},plan:{id:'flw-plan'}}});
  assert.equal(response.status,200);
  const cancel=calls.find(c=>c.url==='rpc/cancel_flutterwave_subscription').body;
  assert.equal(cancel.claim_token,calls[0].body.claim_token);assert.equal(cancel.expected_provider_subscription_id,'provider-1');
});

test('initial month calculation clamps UTC dates and preserves time across DST',()=>{
  const activation=load(path.resolve(__dirname,'../lib/payments/activate-paid-trial.ts'),{
    '@/lib/supabase-server-rest':{},'@/lib/payments/catalog':{},'@/lib/payments/flutterwave':{},
  },'\nexports.addOneMonth = addOneMonth;');
  for(const [start,end] of [['2028-01-31T23:30:00Z','2028-02-29T23:30:00.000Z'],['2027-01-31T23:30:00Z','2027-02-28T23:30:00.000Z'],['2028-03-12T06:30:00Z','2028-04-12T06:30:00.000Z'],['2028-12-31T23:30:00Z','2029-01-31T23:30:00.000Z']])assert.equal(activation.addOneMonth(new Date(start)).toISOString(),end);
});

test('activation retries repair wallet synchronization without reapplying the paid period',async()=>{
  let syncs=0, patches=0;
  const activation=load(path.resolve(__dirname,'../lib/payments/activate-paid-trial.ts'),{
    '@/lib/supabase-server-rest':{supabaseRest:async(url,init={})=>{
      if(url==='rpc/sync_flux_credit_wallet_from_subscription'){syncs++;if(syncs===1)throw new Error('wallet unavailable');return {};}
      if(init.method==='PATCH'){patches++;throw new Error('period should not change');}
      return [{id:'sub',status:'active',metadata:{paid_checkout_session_id:'checkout'}}];
    }},
    '@/lib/payments/catalog':{getPublicPlan:async()=>({custom:false,recurringFee:100})},
    '@/lib/payments/flutterwave':{},
  });
  const args=[{id:'checkout',plan_slug:'basic',billing_region:'NG',organization_id:'org',tx_ref:'tx'},{id:1,tx_ref:'tx',status:'successful',amount:100,currency:'NGN'}];
  await assert.rejects(activation.activatePaidTrialSubscription(...args),/wallet unavailable/);
  assert.equal((await activation.activatePaidTrialSubscription(...args)).alreadyApplied,true);
  assert.equal(syncs,2);assert.equal(patches,0);
});

test('legacy webhook URL delegates to the same recoverable handler',async()=>{
  const request={};let seen;
  const route=load(path.resolve(__dirname,'../app/api/payments/flutterwave/webhook/route.ts'),{
    '@/app/api/webhooks/flutterwave/route':{POST:async input=>{seen=input;return {status:503};}},
  });
  assert.equal((await route.POST(request)).status,503);assert.equal(seen,request);
});
