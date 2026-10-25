const test=require('node:test');const assert=require('node:assert/strict');const load=require('./helpers/load-typescript.cjs');
const {isRealEstateOrganizationRecord,resolveActiveRealEstateOrganization}=load('lib/real-estate-organization.ts',{});
test('real-estate readiness requires active status and an explicit Limitless slug or real-estate industry',()=>{
 assert.equal(isRealEstateOrganizationRecord({slug:'limitless-realty',status:'active'}),true);
 assert.equal(isRealEstateOrganizationRecord({slug:'other-co',status:'active',metadata:{industry_slug:'real-estate'}}),true);
 assert.equal(isRealEstateOrganizationRecord({slug:'other-co',status:'active',metadata:{industry:'real estate'}}),true);
 assert.equal(isRealEstateOrganizationRecord({slug:'other-co',status:'active',metadata:{industry:'finance'}}),false);
 assert.equal(isRealEstateOrganizationRecord({slug:'limitless-realty',status:'paused'}),false);
 assert.equal(isRealEstateOrganizationRecord({slug:'other-co',status:'paused',metadata:{industry:'real estate'}}),false);
});
test('real-estate organization lookup is server-scoped to the requested active organization',async()=>{
 let selected='',eq=[];const client={from:(table)=>{selected=table;return{select:(columns)=>{assert.equal(columns,'id,name,slug,status,metadata');return{eq:(key,value)=>{eq.push([key,value]);return{maybeSingle:async()=>({data:{id:'org-2',name:'Second Realty',slug:'second-realty',status:'active',metadata:{industry:'real estate'}},error:null})}}}}}}};
 const organization=await resolveActiveRealEstateOrganization(client,'org-2');assert.equal(selected,'organizations');assert.deepEqual(eq,[['id','org-2']]);assert.equal(organization.id,'org-2');assert.equal(organization.slug,'second-realty');
});
