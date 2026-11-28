const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const load = require("./helpers/load-typescript.cjs");
function harness({fail=false}={}) {
 const writes=[],calls=[];
 const registry={inventory:[{id:"123",name:"birthday_wishes",language:"en",status:"APPROVED",category:"MARKETING",purpose:"",mapping_status:"unlinked",suggested_purpose:"campaign",placeholder_indexes:[1],components:[{type:"BODY",text:"Private template copy"}]}],missingMappings:[{name:"old",language:"en",purpose:"campaign"}]};
 const sync=load(path.resolve(__dirname,"../lib/whatsapp-template-sync.ts"),{
  "@/lib/supabase/admin":{createAdminClient:()=>({from:table=>({insert:async row=>{writes.push({table,row});return {error:fail?{message:"failed"}:null};}})})},
  "@/lib/portal-campaign-templates":{CampaignTemplateError:class extends Error{},loadLinkedCampaignTemplates:async(...args)=>{calls.push(args);return registry;}},
 });
 return {sync,writes,calls};
}
test("synchronization stores scoped metadata without template copy or activating a mapping",async()=>{
 const {sync,writes,calls}=harness();
 const result=await sync.syncWhatsAppTemplateInventory("tenant-a");
 assert.equal(result.unlinked,1);assert.equal(result.missingMappings,1);
 assert.equal(calls[0][0],"tenant-a");assert.equal(calls[0][2],null);
 assert.equal(writes.length,1);assert.equal(writes[0].table,"audit_logs");
 assert.equal(writes[0].row.organization_id,"tenant-a");
 assert.equal(writes[0].row.metadata.templates[0].suggested_purpose,"campaign");
 assert.doesNotMatch(JSON.stringify(writes),/Private template copy/);
});
test("audit write failure is not reported as a successful sync",async()=>{
 const {sync}=harness({fail:true});
 await assert.rejects(sync.syncWhatsAppTemplateInventory("tenant-a"),/Unable to save/);
});
