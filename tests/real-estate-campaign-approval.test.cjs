const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const api=load(path.resolve(__dirname,'../lib/real-estate-campaign-approval.ts'));
const ORG='b15f21b4-5697-4d21-9421-8a34eae3476d';
const session={email:'ADMIN@EXAMPLE.TEST',name:'Admin',issuedAt:1792848000000};
const lead=(id,phone,name)=>({id,phone,name,status:'new',campaign_eligible:true});

function base(overrides={}) {
 return api.campaignApprovalArguments({
  organizationId:ORG,requestId:'request-123',campaignType:'limitless_realty_update',topic:'Abuja duplex update',message:'Exact approved message',messageParts:['Exact approved message'],templateName:'limitless_realty_update_v2',mediaUrl:null,audienceMode:'manual',selectedLeadIds:['lead-b','lead-a'],
  campaignGroup:{id:'group-1',name:'Group',groupType:'manual',description:'',leadIds:['lead-a','lead-b'],phones:[],updatedAt:'2026-10-24T10:00:00Z'},
  property:{id:'property-1',title:'Verified duplex',organization_id:ORG,location_city:'Abuja',price:'N10',status:'active'},
  recipients:[lead('lead-b','+234 803 000 0002','Bola'),lead('lead-a','+234 803 000 0001','Ada')],skipped:1,...overrides,
 });
}

test('campaign approval identity and session derive only from signed admin session plus organization/request',()=>{
 const identity=api.campaignApprovalIdentity(session);
 assert.deepEqual({...identity},{scope:'super_admin',role:'super_admin',email:'admin@example.test',channel:'api',globalScope:true});
 const sessionId=api.campaignApprovalSessionId(session,ORG,'request-123');
 assert.match(sessionId,/admin@example\.test/);
 assert.match(sessionId,new RegExp(ORG));
 assert.match(sessionId,/request-123/);
 assert.throws(()=>api.campaignApprovalIdentity({...session,email:'',issuedAt:0}),/valid signed admin session/);
});

test('approval snapshot is order-stable and binds every message, recipient, group and property input',()=>{
 const first=base();
 const reversed=base({recipients:[lead('lead-a','+234 803 000 0001','Ada'),lead('lead-b','+234 803 000 0002','Bola')],selectedLeadIds:['lead-a','lead-b']});
 assert.deepEqual(first,reversed);
 assert.notDeepEqual(first,base({message:'Changed message'}));
 assert.notDeepEqual(first,base({topic:'Different campaign'}));
 assert.notDeepEqual(first,base({recipients:[lead('lead-b','+234 803 000 0009','Bola'),lead('lead-a','+234 803 000 0001','Ada')]}));
 assert.notDeepEqual(first,base({property:{id:'property-other',title:'Other property',organization_id:ORG}}));
 assert.notDeepEqual(first,base({campaignGroup:{id:'group-other',name:'Other',groupType:'manual',description:'',leadIds:['lead-a','lead-b'],phones:[],updatedAt:'2026-10-24T10:00:00Z'}}));
});
