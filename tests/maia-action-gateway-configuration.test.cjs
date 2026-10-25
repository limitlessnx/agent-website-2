const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const gatewayPath=path.resolve(__dirname,'../lib/maia-action-gateway.ts');
const expectedCode="const value = $json.body && typeof $json.body === 'object' ? $json.body : $json; return { json: value };";
function fixture(overrides={}){
 const workflow={id:'workflow-1',name:'Maia Action - Search Lead',active:true,nodes:[
  {name:'Route Delete Request',type:'n8n-nodes-base.switch'},
  {name:'Fluxknight Maia Action Webhook',type:'n8n-nodes-base.webhook',parameters:{httpMethod:'POST',path:'fluxknight-maia-action',responseMode:'onReceived'}},
  {name:'Fluxknight Normalize Maia Action',type:'n8n-nodes-base.code',parameters:{mode:'runOnceForEachItem',jsCode:expectedCode}},
 ],connections:{
  'Fluxknight Maia Action Webhook':{main:[[{node:'Fluxknight Normalize Maia Action',type:'main',index:0}]]},
  'Fluxknight Normalize Maia Action':{main:[[{node:'Route Delete Request',type:'main',index:0}]]},
 }};
 return {...workflow,...overrides};
}
function loadGateway(workflow){
 const changes={updates:0,activations:0};
 const api={getN8nWorkflow:async()=>workflow,findN8nWorkflowByName:async()=>null,getN8nBaseUrl:()=>"https://n8n.invalid",listN8nExecutions:async()=>[],updateN8nWorkflow:async()=>{changes.updates++;return workflow},activateN8nWorkflow:async()=>{changes.activations++;return workflow}};
 return {gateway:load(gatewayPath,{'@/lib/n8n-api':api,'@/lib/lead-profile-service':{normalizeLeadPhone:(value)=>String(value||'').replace(/\D/g,'')}}),changes};
}

test('valid active campaign workflow is verified without making any n8n changes',async()=>{
 const {gateway,changes}=loadGateway(fixture());
 const result=await gateway.verifyMaiaActionWebhook();
 assert.equal(result.verified,true);
 assert.equal(result.workflowId,'workflow-1');
 assert.deepEqual(changes,{updates:0,activations:0});
});

test('missing, inactive or miswired workflows fail closed without repair or reactivation',async()=>{
 const cases=[fixture({active:false}),fixture({nodes:fixture().nodes.filter((node)=>node.name!=='Fluxknight Normalize Maia Action')}),fixture({connections:{}}),fixture({nodes:fixture().nodes.map((node)=>node.name==='Fluxknight Maia Action Webhook'?{...node,parameters:{...node.parameters,path:'wrong-path'}}:node)})];
 for(const candidate of cases){
  const {gateway,changes}=loadGateway(candidate);
  await assert.rejects(gateway.verifyMaiaActionWebhook(),/not configured and active/);
  assert.deepEqual(changes,{updates:0,activations:0});
 }
});

test('a missing workflow fails closed before any update attempt',async()=>{
 const {gateway,changes}=loadGateway(null);
 await assert.rejects(gateway.verifyMaiaActionWebhook(),/proven n8n workflow.*not found/);
 assert.deepEqual(changes,{updates:0,activations:0});
});
