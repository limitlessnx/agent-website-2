const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const root=path.resolve(__dirname,'..');
const A='b15f21b4-5697-4d21-9421-8a34eae3476d';
const B='7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4';
const LA='c0000000-0000-4000-8000-000000000001';
const GROUP='d0000000-0000-4000-8000-000000000001';

function fixture() {
  const calls=[];
  const leadReads=[];
  const api=load(path.join(root,'lib/real-estate-campaign-groups.ts'),{
    '@/lib/supabase-server-rest':{supabaseServerRequest:async(endpoint,options={})=>{
      calls.push({endpoint,options});
      if(endpoint.includes('rpc/save_real_estate_campaign_group_with_audit')) return [{id:GROUP,organization_id:A,name:'Eligible group',group_type:'manual',description:'',rules:{},created_by:'operator',created_at:'2026-10-24T00:00:00Z',updated_at:'2026-10-24T00:00:00Z'}];
      if(endpoint.startsWith('real_estate_campaign_groups?')) return endpoint.includes(`organization_id=eq.${A}`)?[{id:GROUP,organization_id:A,name:'Eligible group',group_type:'manual',description:'',rules:{},created_by:'operator',created_at:'2026-10-24T00:00:00Z',updated_at:'2026-10-24T00:00:00Z'}]:[];
      if(endpoint.startsWith('real_estate_campaign_group_members?')) return [{group_id:GROUP,lead_id:LA}];
      return [];
    }},
    '@/lib/lead-profile-service':{
      normalizeLeadPhone:(phone)=>String(phone||'').replace(/\D/g,''),
      getCampaignAudienceLeads:async(orgId)=>{leadReads.push(orgId);return [{id:LA,phone:'+234 803 000 0001',status:'new',campaign_eligible:true},{id:'c0000000-0000-4000-8000-000000000002',phone:'+234 803 000 0002',status:'opted_out',campaign_eligible:true}];},
    },
  });
  return {api,calls,leadReads};
}

test('manual group phone input resolves only to eligible CRM leads and stores no free-form phone list',async()=>{
 const {api,calls,leadReads}=fixture();
 const group=await api.saveRealEstateCampaignGroup({organizationId:A,actorId:'operator@example.test',name:'Eligible group',groupType:'manual',phones:['+234 803 000 0001']});
 assert.deepEqual(leadReads,[A]);
 const saveCall=calls.find(call=>call.endpoint.includes('rpc/save_real_estate_campaign_group_with_audit'));
 assert.equal(saveCall.options.method,'POST');
 assert.deepEqual(JSON.parse(saveCall.options.body),{p_organization_id:A,p_actor_id:'operator@example.test',p_group_id:null,p_name:'Eligible group',p_group_type:'manual',p_description:'',p_rules:{},p_lead_ids:[LA]});
 assert.deepEqual([...group.leadIds],[LA]);
 assert.deepEqual([...group.phones],[]);
});

test('unknown and opted-out phone-only group members fail closed',async()=>{
 const {api}=fixture();
 await assert.rejects(()=>api.saveRealEstateCampaignGroup({organizationId:A,actorId:'operator',name:'Unsafe',phones:['+234 803 000 0009']}),/only campaign-eligible CRM leads/);
 await assert.rejects(()=>api.saveRealEstateCampaignGroup({organizationId:A,actorId:'operator',name:'Opted out',phones:['+234 803 000 0002']}),/only campaign-eligible CRM leads/);
});

test('group reads are tenant-filtered and never return another organization’s group',async()=>{
 const {api,calls}=fixture();
 assert.equal(await api.getRealEstateCampaignGroup(B,GROUP),null);
 assert.match(calls[0].endpoint,/organization_id=eq\.7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4/);
});

test('smart group rules stay bounded to known fields and never allow pinned recipients',async()=>{
 const {api}=fixture();
 await assert.rejects(()=>api.saveRealEstateCampaignGroup({organizationId:A,actorId:'operator',name:'No rules',groupType:'smart'}),/at least one smart filter/);
 await assert.rejects(()=>api.saveRealEstateCampaignGroup({organizationId:A,actorId:'operator',name:'Pinned smart',groupType:'smart',leadIds:[LA],rules:{state:'Lagos'}}),/cannot pin individual leads/);
});
