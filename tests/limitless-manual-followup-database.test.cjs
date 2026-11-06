const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const A='b15f21b4-5697-4d21-9421-8a34eae3476d', B='7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4';
const LEAD='50000000-0000-4000-8000-000000000001', PROPERTY='60000000-0000-4000-8000-000000000001';
const migration='supabase/migrations/20261106213418_limitless_manual_followup_activation.sql';
async function database() {
  const db=new PGlite();
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
    create table organizations(id uuid primary key,status text,slug text);
    insert into organizations values('${A}','active','limitless-realty'),('${B}','active','other');
    create table leads(id uuid primary key,organization_id uuid references organizations(id),name text,phone text,status text,opted_out boolean default false,updated_at timestamptz default now());
    create table properties(id uuid primary key,organization_id uuid references organizations(id),title text);
    insert into leads(id,organization_id,name,phone,status) values('${LEAD}','${A}','Test lead','08000000001','cold');
    insert into properties values('${PROPERTY}','${A}','Test estate');
    create table follow_ups(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),lead_id uuid not null,stage integer not null,
      scheduled_at timestamptz not null,sent_at timestamptz,message_sent text,status text default 'pending',channel text default 'whatsapp',agent_key text default 'maia',template_name text,created_at timestamptz default now());
    alter table follow_ups enable row level security;
    create policy fixture_existing_followup_access on follow_ups for all to anon,authenticated using(true) with check(true);
    grant all on follow_ups to anon,authenticated,service_role;`);
  await db.exec(fs.readFileSync('supabase/migrations/20261025210424_20261024140800_tenant_customer_contacts.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261030191816_limitless_maia_followup_sequence_identity.sql','utf8'));
  await db.exec(fs.readFileSync(migration,'utf8'));
  return db;
}
const steps=()=>[1,3,7,14,21,30].map((day,index)=>({sequence_step_key:`day-${day}`,stage:index+1,scheduled_at:new Date(Date.now()+day*86400000).toISOString(),due_at:new Date(Date.now()+day*86400000).toISOString(),message_sent:'Checking in about Test estate.'}));
async function activate(db,extra={}) {
  const values={org:A,lead:LEAD,property:PROPERTY,reason:'Prior property enquiry',notes:'Internal context',actor:'admin:test',consent:true,steps:steps(),...extra};
  const result=await db.query('select activate_limitless_manual_followup($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as result',[values.org,values.lead,values.property,values.reason,values.notes,values.actor,values.consent,JSON.stringify(values.steps)]);
  return result.rows[0].result;
}
test('manual activation atomically creates an active sequence, recorded consent, audit and six runnable steps with first due now',async()=>{
  const db=await database();try{
    const result=await activate(db);assert.equal(result.created,true);assert.equal(result.status,'active');assert.equal(result.first_step_status,'pending');
    const rows=(await db.query('select * from follow_ups order by stage')).rows;assert.equal(rows.length,6);
    assert.ok(Date.parse(rows[0].scheduled_at)<=Date.now());assert.ok(rows.every(row=>row.sequence_id===result.sequence_id&&row.organization_id===A&&row.consent_state==='opted_in'));
    assert.equal((await db.query('select phone,whatsapp_consent from tenant_customer_contacts')).rows[0].phone,'2348000000001');
    const event=(await db.query("select * from limitless_maia_followup_events where event_type='manual_activation'")).rows[0];assert.equal(event.reason,'Prior property enquiry');assert.equal(event.metadata.notes,'Internal context');
  }finally{await db.close();}
});
test('double activation reuses the same active sequence without resetting or duplicating steps or consent events',async()=>{
  const db=await database();try{
    const first=await activate(db);const again=await activate(db);assert.equal(again.created,false);assert.equal(first.sequence_id,again.sequence_id);
    assert.equal((await db.query('select count(*)::int as n from follow_ups')).rows[0].n,6);
    assert.equal((await db.query("select count(*)::int as n from limitless_maia_followup_events where event_type='opt_in'")).rows[0].n,1);
  }finally{await db.close();}
});
test('tenant, property, permission confirmation and lead opt-outs fail closed without enrollment',async()=>{
  const db=await database();try{
    for(const extra of [{org:B},{property:'60000000-0000-4000-8000-000000000099'},{consent:false},{reason:''}])await assert.rejects(()=>activate(db,extra));
    await db.exec(`update leads set opted_out=true where id='${LEAD}'`);await assert.rejects(()=>activate(db),/opted out/);
    assert.equal((await db.query('select count(*)::int as n from follow_ups')).rows[0].n,0);
  }finally{await db.close();}
});
test('contact opt-out and normalized phone ambiguity cannot be overridden by the manual confirmation',async()=>{
  const db=await database();try{
    await db.exec(`insert into tenant_customer_contacts(organization_id,full_name,phone,whatsapp_consent) values('${A}','Opted out','+2348000000001','opted_out')`);
    await assert.rejects(()=>activate(db),/opted out/);
    await db.exec(`update tenant_customer_contacts set whatsapp_consent='unknown';insert into tenant_customer_contacts(organization_id,full_name,phone) values('${A}','Duplicate','08000000001')`);
    await assert.rejects(()=>activate(db),/multiple customer contacts/);
  }finally{await db.close();}
});
test('paused sequences require the explicit resume control and cannot be replaced by another sequence',async()=>{
  const db=await database();try{
    const first=await activate(db);await db.query("update limitless_maia_followup_sequences set status='paused' where id=$1",[first.sequence_id]);
    await assert.rejects(()=>activate(db),/paused follow-up/);
    assert.equal((await db.query('select count(*)::int as n from limitless_maia_followup_sequences')).rows[0].n,1);
  }finally{await db.close();}
});
test('invalid schedule rolls back contact creation, sequence creation and all consent/audit writes',async()=>{
  const db=await database();try{
    await assert.rejects(()=>activate(db,{steps:steps().slice(0,5)}),/six-step/);
    for(const table of ['tenant_customer_contacts','limitless_maia_followup_sequences','limitless_maia_followup_events','follow_ups'])assert.equal((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n,0);
  }finally{await db.close();}
});
test('browser database roles cannot invoke the activation function',async()=>{
  const db=await database();try{
    for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(()=>activate(db),/permission denied/);await db.exec('reset role');}
  }finally{await db.close();}
});
