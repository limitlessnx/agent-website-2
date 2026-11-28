const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveTenantWhatsAppCredentials } = require('./helpers/load-typescript.cjs')(path.resolve(__dirname,'../lib/whatsapp-credentials.ts'));
const LIMITLESS = 'b15f21b4-5697-4d21-9421-8a34eae3476d';
function fixture(rows, vault) {
 const calls=[];
 const admin={
  from(table){let org,provider;return {select(){return this},eq(k,v){if(k==='organization_id')org=v;if(k==='provider')provider=v;return this},in(){return this},maybeSingle:async()=>{calls.push([table,org,provider]);return rows[org+':'+provider]||{data:null}}}},
  rpc:async(_name,args)=>{calls.push(['vault',args.p_organization_id,args.p_provider]);return vault[args.p_organization_id+':'+args.p_provider]||{data:null}},
 };
 return {admin,calls};
}
const integration={data:{configuration:{waba_id:'123',phone_number_id:'456',graph_version:'v26.0'}}};
const creds={data:{access_token:'fixture-token'}};
test('inventory and delivery resolve exact same tenant account and configured version',async()=>{
 const {admin,calls}=fixture({'a:whatsapp':integration,'b:whatsapp':integration},{'a:whatsapp':creds,'b:whatsapp':{data:{access_token:'other-token'}}});
 const inventory=await resolveTenantWhatsAppCredentials(admin,'a',{inventory:true},{});
 const delivery=await resolveTenantWhatsAppCredentials(admin,'a',{allowLegacyDelivery:true},{});
 assert.equal(inventory.wabaId,'123');assert.equal(delivery.phoneNumberId,'456');
 assert.equal(inventory.accessToken,delivery.accessToken);assert.equal(delivery.graphVersion,'v26.0');
 assert.ok(calls.every(call=>call[1]==='a'));
});
test('alias is permitted only if primary integration is absent',async()=>{
 const secondary={'a:meta_whatsapp':integration};
 const vault={'a:meta_whatsapp':creds};
 const absent=fixture(secondary,vault);
 assert.equal((await resolveTenantWhatsAppCredentials(absent.admin,'a',{inventory:true},{})).wabaId,'123');
 const incomplete=fixture({...secondary,'a:whatsapp':integration},vault);
 await assert.rejects(resolveTenantWhatsAppCredentials(incomplete.admin,'a',{allowLegacyDelivery:true},{}),/credentials are not available/);
 assert.ok(incomplete.calls.every(call=>call[2]!=='meta_whatsapp'));
});
test('legacy delivery cannot be used by other tenants or inventory',async()=>{
 const {admin}=fixture({},{});
 const env={WHATSAPP_PHONE_NUMBER_ID:'456',WHATSAPP_ACCESS_TOKEN:'legacy-fixture'};
 assert.equal((await resolveTenantWhatsAppCredentials(admin,LIMITLESS,{allowLegacyDelivery:true},env)).source,'legacy_env');
 await assert.rejects(resolveTenantWhatsAppCredentials(admin,'other',{allowLegacyDelivery:true},env),/Connect WhatsApp/);
 await assert.rejects(resolveTenantWhatsAppCredentials(admin,LIMITLESS,{inventory:true,allowLegacyDelivery:true},env),/Connect WhatsApp/);
});
test('Twilio cannot be mistaken for Meta, and incomplete providers fail closed',async()=>{
 const twilio={data:{provider_family:'twilio',twilio_account_sid:'AC-fixture',twilio_auth_token:'test',twilio_whatsapp_sender:'+123'}};
 const {admin}=fixture({'a:whatsapp':integration},{'a:whatsapp':twilio});
 assert.equal((await resolveTenantWhatsAppCredentials(admin,'a',{},{})).providerFamily,'twilio');
 await assert.rejects(resolveTenantWhatsAppCredentials(admin,'a',{inventory:true},{}),/Meta WhatsApp/);
 const broken=fixture({'a:whatsapp':integration},{'a:whatsapp':{data:{...twilio.data,twilio_auth_token:'',access_token:'meta-fixture'}}});
 await assert.rejects(resolveTenantWhatsAppCredentials(broken.admin,'a',{},{}),/Twilio WhatsApp credentials are incomplete/);
});
