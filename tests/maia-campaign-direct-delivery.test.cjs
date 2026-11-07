const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const gatewayPath=path.resolve(__dirname,'../lib/maia-action-gateway.ts');

function fixture(){
 const calls=[];
 const api={findN8nWorkflowByName:async()=>null,getN8nBaseUrl:()=>"https://n8n.invalid",getN8nWorkflow:async()=>null,listN8nExecutions:async()=>[]};
 const gateway=load(gatewayPath,{
  '@/lib/n8n-api':api,
  '@/lib/lead-profile-service':{normalizeLeadPhone:(value)=>String(value||'').replace(/\D/g,'')},
  '@/lib/whatsapp-delivery':{sendWhatsAppMessage:async(input)=>{calls.push(input);return{ok:true,provider:'meta',providerMessageId:`wamid.${calls.length}`};}},
 });
 return{gateway,calls};
}

test('estate brief campaigns use the canonical provider gateway, five ordered variables and header image',async()=>{
 const {gateway,calls}=fixture();
 const result=await gateway.dispatchMaiaCampaignAction({
  commandId:'campaign-1',
  campaignType:'estate_brief_update',
  templateName:'estate_brief_update',
  topic:'Estate launch',
  message:'Flexible six-month installment plan.',
  sellingPoint:'Flexible six-month installment plan.',
  propertyTitle:'D Prince Builders Hilltop Estate',
  propertyLocation:'Bénin City, Edo State',
  propertyPrice:'₦1,200,000',
  mediaUrl:'https://cdn.example.test/estate.jpg',
  recipients:[{id:'lead-1',name:'Greatness',phone:'2348012345678'}],
 });
 assert.equal(calls.length,1);
 assert.equal(calls[0].templatePurpose,'estate_brief_update');
 assert.equal(calls[0].requestedTemplateName,'estate_brief_update');
 assert.deepEqual(Array.from(calls[0].strictTemplateContract.approvedVariableOrder),['customer_name','property_name','property_location','property_price','selling_point']);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].variables)),{customer_name:'Greatness',property_name:'D Prince Builders Hilltop Estate',property_location:'Bénin City, Edo State',property_price:'₦1,200,000',selling_point:'Flexible six-month installment plan.'});
 assert.equal(calls[0].templateHeaderImageUrl,'https://cdn.example.test/estate.jpg');
 assert.equal(result.accepted,1);
 assert.deepEqual(Array.from(result.path),['campaign_api','whatsapp_delivery_gateway','meta_or_twilio_provider']);
});

test("Limitless Realty relationship campaigns route the approved three-variable Meta template in exact order",async()=>{
 const {gateway,calls}=fixture();
 const result=await gateway.dispatchMaiaCampaignAction({
  commandId:"campaign-relationship-1",
  campaignType:"limitless_realty_relationship_campaign",
  templateName:"limitless_realty_relationship_campaign",
  topic:"November new month",
  message:"Welcome to a new month!\n\nExplore our latest property opportunities and speak with our team.",
  recipients:[{id:"lead-relationship-1",name:"Ada",phone:"2348012345678"}],
 });
 assert.equal(calls.length,1);
 assert.equal(calls[0].templatePurpose,"limitless_realty_relationship_campaign");
 assert.equal(calls[0].requestedTemplateName,"limitless_realty_relationship_campaign");
 assert.deepEqual(Array.from(calls[0].strictTemplateContract.approvedVariableOrder),["customer_name","greeting","call_to_action"]);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].variables)),{customer_name:"Ada",greeting:"Welcome to a new month!",call_to_action:"Explore our latest property opportunities and speak with our team."});
 assert.equal(result.templateSent,1);
 assert.equal(result.accepted,1);
});

test('unregistered campaign template types fail closed instead of falling back to n8n or another template',async()=>{
 const {gateway,calls}=fixture();
 await assert.rejects(gateway.dispatchMaiaCampaignAction({
  commandId:'campaign-2',campaignType:'unregistered_template',templateName:'unregistered_template',
  topic:'Reminder',message:'A reminder',recipients:[{id:'lead-1',name:'Client',phone:'2348012345678'}],
 }),/no verified direct WhatsApp route/);
 assert.equal(calls.length,0);
});
