const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const normalizer=load(path.resolve(__dirname,'../lib/whatsapp-message-normalizer.ts'));
function fixture(provider, providerStatus='approved') {
 const calls=[];
 const admin={from:()=>({select(){return this},eq(){return this},in(){return this},limit(){return this},maybeSingle:async()=>({data:{id:'integration',configuration:{provider_family:provider}}})}),rpc:async()=>({data:provider==='twilio'?{provider_family:'twilio',twilio_account_sid:'test',twilio_auth_token:'test',twilio_whatsapp_sender:'+123'}:{phone_number_id:'test',access_token:'test'}})};
 const api=load(path.resolve(__dirname,'../lib/whatsapp-delivery.ts'),{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/whatsapp-message-normalizer':normalizer,
  '@/lib/twilio-whatsapp':{sendTwilioWhatsAppMessage:async input=>{calls.push(input);return {sid:'twilio-id'}}},
 },'',{process:{env:{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test'}},fetch:async(url,init)=>{
  const response=body=>({ok:true,status:200,json:async()=>body});
  if(String(url).includes('whatsapp_template_configs')) return response([{template_name:'hotel_recovery',language_code:'en',variable_keys:['customer_name'],metadata:{provider_status:providerStatus,twilio_content_sid:'HXtest'}}]);
  if(String(url).includes('whatsapp_delivery_attempts'))return response([]);
  if(String(url).includes('graph.facebook.com')) {calls.push(JSON.parse(init.body));return response({messages:[{id:'meta-id'}]})}
  throw Error('Unexpected fetch');
 }});return {api,calls};
}
const input={organizationId:'hotel-a',to:'123',deliveryMode:'template',templatePurpose:'hotel_booking_recovery',requestedTemplateName:'hotel_recovery',requireProviderApproval:true,variables:{customer_name:'Ada'}};
test('Meta and Twilio hotel templates require verified approval before provider submission',async()=>{
 for(const provider of ['meta','twilio']) {
  for(const status of ['pending','rejected',undefined]) {const {api,calls}=fixture(provider,status===undefined?null:status);await assert.rejects(api.sendWhatsAppMessage(input),/provider approval/);assert.equal(calls.length,0)}
  const {api,calls}=fixture(provider);const result=await api.sendWhatsAppMessage(input);assert.ok(result.providerMessageId);assert.equal(calls.length,1);
 }
});
test('missing variables and closed customer windows cannot submit a hotel message',async()=>{
 const {api,calls}=fixture('meta');
 await assert.rejects(api.sendWhatsAppMessage({...input,variables:{}}),/required/);
 await assert.rejects(api.sendWhatsAppMessage({...input,deliveryMode:'direct',lastCustomerMessageAt:null}),/24-hour/);
 assert.equal(calls.length,0);
});
test('hotel templates map existing composer numbered values to configured named variable order',async()=>{
 const {api,calls}=fixture('meta');await api.sendWhatsAppMessage({...input,variables:{'1':'Ada'}});
 assert.equal(calls[0].template.components[0].parameters[0].text,'Ada');
});
