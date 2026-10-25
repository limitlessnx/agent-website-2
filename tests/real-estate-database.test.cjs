const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const A='b15f21b4-5697-4d21-9421-8a34eae3476d',B='7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4';
const E='10000000-0000-4000-8000-000000000001',P='20000000-0000-4000-8000-000000000001',C='9f3d8c22-087e-4bd8-a4e1-2d39114e86df';
async function database(){
 const db=new PGlite();await db.exec(`
 CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE TABLE organizations(id uuid PRIMARY KEY,name text,slug text,status text DEFAULT 'active',metadata jsonb DEFAULT '{}');
 INSERT INTO organizations VALUES ('${A}','Fixture A','limitless-realty','active','{}'),('${B}','Fixture B','fixture-b-realty','active','{"industry":"real_estate"}'),('${C}','Fixture C','fixture-c','active','{"industry":"retail"}');
 CREATE TABLE properties(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),title text,price text,image_urls jsonb,status text DEFAULT 'active',updated_at timestamptz DEFAULT now());
 CREATE TABLE knowledge_sources(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),title text,status text DEFAULT 'ready',content text);
 CREATE TABLE leads(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),name text,status text,viewing_booked boolean DEFAULT false,viewing_datetime timestamptz);
 CREATE TABLE follow_ups(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),status text);
 CREATE TABLE crm_customers(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),status text DEFAULT 'active',metadata jsonb DEFAULT '{}');
 CREATE TABLE crm_leads(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),customer_id uuid,status text);
 CREATE TABLE domain_events(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),UNIQUE(organization_id,id));
 CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),action text NOT NULL,resource_type text NOT NULL,resource_id text,metadata jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());
 CREATE TABLE appointments(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),status text,external_event_id text,customer_id uuid,start_at timestamptz,end_at timestamptz,metadata jsonb DEFAULT '{}',UNIQUE(organization_id,id));
 CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now();RETURN NEW;END;$$;
 CREATE FUNCTION is_organization_member(org uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT org::text=current_setting('test.organization',true)$$;
 CREATE FUNCTION has_organization_permission(org uuid,permission text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT is_organization_member(org) AND position(permission IN current_setting('test.permissions',true))>0$$;
 `);
 for(const path of ['supabase/migrations/20261024141200_real_estate_action_approvals.sql','supabase/migrations/20261024141300_real_estate_inspections.sql','supabase/migrations/20261024141400_real_estate_estate_catalog.sql','supabase/migrations/20261024141500_real_estate_knowledge_links.sql','supabase/migrations/20261024141600_real_estate_outbound_tracking.sql','supabase/migrations/20261024141700_real_estate_delivery_receipts.sql','supabase/migrations/20261024141800_real_estate_atomic_audit.sql','supabase/migrations/20261024142100_real_estate_campaign_groups.sql','supabase/migrations/20261024142200_real_estate_customer_service_windows.sql'])await db.exec(fs.readFileSync(path,'utf8'));
 return db;
}
const digest='a'.repeat(64),token='b'.repeat(64);
async function issue(db,id,org=A){await db.query('select * from create_real_estate_action_approval($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)',[id,org,'user','fixture-user','leo.crm.leads.update',digest,'fixture-session','chat',token,new Date(Date.now()+60000).toISOString()]);}
async function consume(db,id,principal='fixture-user',org=A){return(await db.query('select * from consume_real_estate_action_approval($1,$2,$3,$4,$5,$6,$7,$8,$9,true)',[id,org,'user',principal,'leo.crm.leads.update',digest,'fixture-session','chat',token])).rows[0];}
test('real PostgreSQL approval functions reject mismatch, expire and consume once',async()=>{
 const db=await database();try{const id='30000000-0000-4000-8000-000000000001';await issue(db,id);assert.equal((await consume(db,id,'other-user')).status,'rejected');const results=await Promise.all([consume(db,id),consume(db,id)]);assert.deepEqual(results.map(r=>r.status).sort(),['accepted','consumed']);
 const expired='30000000-0000-4000-8000-000000000002';await issue(db,expired);await db.query("update real_estate_action_approvals set expires_at=now()-interval '1 minute' where id=$1",[expired]);assert.equal((await consume(db,expired)).status,'expired');
 const second='30000000-0000-4000-8000-000000000003';await issue(db,second,B);assert.equal((await consume(db,second,'fixture-user',B)).status,'accepted');
 await db.exec('SET ROLE anon');await assert.rejects(db.query('select count(*) from real_estate_action_approvals'),/permission denied/);await db.exec('RESET ROLE');
 }finally{await db.close();}
});
test('real PostgreSQL estate tenant FK prevents crossing and estate deletion preserves canonical listing',async()=>{
 const db=await database();try{await db.query('insert into real_estate_estates(id,organization_id,name) values($1,$2,$3)',[E,A,'A estate']);await db.query('insert into properties(id,organization_id,title,price,image_urls) values($1,$2,$3,$4,$5)',[P,B,'Original','N100','["original.jpg"]']);await assert.rejects(db.query('update properties set estate_id=$1 where id=$2',[E,P]),/foreign key/);
 await db.query('update properties set organization_id=$1 where id=$2',[A,P]);await db.query('update properties set estate_id=$1 where id=$2',[E,P]);await db.query('delete from real_estate_estates where id=$1',[E]);const row=(await db.query('select organization_id,estate_id,title,price,image_urls from properties where id=$1',[P])).rows[0];assert.equal(row.organization_id,A);assert.equal(row.estate_id,null);assert.equal(row.title,'Original');assert.equal(row.price,'N100');assert.deepEqual(row.image_urls,['original.jpg']);
 }finally{await db.close();}
});
test('real PostgreSQL RLS permits only the current tenant and denies viewer knowledge writes',async()=>{
 const db=await database();try{await db.query('insert into real_estate_estates(organization_id,name) values($1,$2),($3,$4)',[A,'A estate',B,'B estate']);await db.exec(`SET test.organization='${A}';SET test.permissions='customers.view';SET ROLE authenticated;`);const rows=(await db.query('select name from real_estate_estates')).rows;assert.deepEqual(rows.map(r=>r.name),['A estate']);await assert.rejects(db.query('insert into real_estate_estates(organization_id,name) values($1,$2)',[A,'Forbidden']),/row-level security/);
 await db.exec("SET test.permissions='customers.manage,knowledge.manage';");await db.query('insert into real_estate_estates(organization_id,name) values($1,$2)',[A,'Permitted']);await assert.rejects(db.query('insert into real_estate_estates(organization_id,name) values($1,$2)',[B,'Cross tenant']),/row-level security/);await db.exec('RESET ROLE');
 }finally{await db.close();}
});
test('real PostgreSQL inspection RPC requires canonical provider event and creates revision-idempotent reminders',async()=>{
 const db=await database();try{
  const C='40000000-0000-4000-8000-000000000001',I='50000000-0000-4000-8000-000000000001',AP='60000000-0000-4000-8000-000000000001';
  await db.query('insert into crm_customers(id,organization_id,status) values($1,$2,$3)',[C,A,'active']);
  await db.query('insert into properties(id,organization_id,title,status) values($1,$2,$3,$4)',[P,A,'Verified','active']);
  await db.query('insert into real_estate_inspections(id,organization_id,customer_id,property_id,property_verification_status,requested_start_at,requested_end_at,status) values($1,$2,$3,$4,$5,$6,$7,$8)',[I,A,C,P,'verified','2030-10-24T09:30:00Z','2030-10-24T10:30:00Z','booking_pending']);
  const transition=`select * from transition_real_estate_inspection($1,$2,'booked',$3,$4,$5,null,$6,'caller-supplied-event','admin',null,null)`;
  await assert.rejects(db.query(transition,[A,I,P,'2030-10-24T11:00:00Z','2030-10-24T12:00:00Z',null]),/Canonical appointment, verified property and customer/);
  await db.query('insert into appointments(id,organization_id,status,external_event_id,customer_id,start_at,end_at) values($1,$2,$3,$4,$5,$6,$7)',[AP,A,'confirmed','provider-event-verified',C,'2030-10-24T09:30:00Z','2030-10-24T10:30:00Z']);
  await db.query(transition.replace('null,$6','null,$6'),[A,I,P,'2030-10-24T11:00:00Z','2030-10-24T12:00:00Z',AP]);
  const stored=(await db.query('select status,requested_start_at,appointment_external_event_id from real_estate_inspections where id=$1',[I])).rows[0];
  assert.equal(stored.status,'booked');assert.equal(stored.requested_start_at.toISOString(),'2030-10-24T09:30:00.000Z');assert.equal(stored.appointment_external_event_id,'provider-event-verified');
  const reminders=await db.query('select * from replace_real_estate_inspection_reminders($1,$2,$3,$4,$5)',[A,I,'2030-10-24T09:30:00Z',C,AP]);assert.equal(reminders.rows.length,2);const ids=reminders.rows.map(row=>row.id).sort();
  await db.query("update real_estate_inspection_jobs set status='completed' where id=$1",[ids[0]]);
  const replay=await db.query('select * from replace_real_estate_inspection_reminders($1,$2,$3,$4,$5)',[A,I,'2030-10-24T09:30:00Z',C,AP]);assert.deepEqual(replay.rows.map(row=>row.id).sort(),ids);
  const completed=(await db.query('select status from real_estate_inspection_jobs where id=$1',[ids[0]])).rows[0];assert.equal(completed.status,'completed');
  await db.query("update appointments set start_at='2030-10-25T09:30:00Z',end_at='2030-10-25T10:30:00Z',external_event_id='provider-event-rescheduled',status='rescheduled' where id=$1",[AP]);
  const rescheduled=await db.query("select * from transition_real_estate_inspection($1,$2,'rescheduled',$3,null,null,null,$4,null,null,null,null)",[A,I,P,AP]);assert.equal(rescheduled.rows[0].status,'rescheduled');
  const revisionTwo=await db.query('select * from replace_real_estate_inspection_reminders($1,$2,$3,$4,$5)',[A,I,'2030-10-25T09:30:00Z',C,AP]);assert.equal(revisionTwo.rows.length,2);assert.equal(revisionTwo.rows.some(row=>ids.includes(row.id)),false);
 }finally{await db.close();}
});

test('scheduler is opt-in, due-tenant-only, pauseable and atomic with its audit record',async()=>{
 const db=await database();try{
  const CA='70000000-0000-4000-8000-000000000001',CB='70000000-0000-4000-8000-000000000002';
  await db.query('insert into crm_customers(id,organization_id,status) values($1,$2,$3),($4,$5,$6)',[CA,A,'active',CB,B,'active']);
  await db.query('insert into properties(id,organization_id,title,status) values($1,$2,$3,$4),($5,$6,$7,$8)',[P,A,'Fixture A property','active','20000000-0000-4000-8000-000000000002',B,'Fixture B property','active']);
  const IA='80000000-0000-4000-8000-000000000001',IB='80000000-0000-4000-8000-000000000002';
  await db.query("insert into real_estate_inspections(id,organization_id,customer_id,property_id,property_verification_status,status,requested_start_at) values($1,$2,$3,$4,'verified','booked',now()+interval '2 days'),($5,$6,$7,$8,'verified','booked',now()+interval '2 days')",[IA,A,CA,P,IB,B,CB,'20000000-0000-4000-8000-000000000002']);
  await db.query("insert into real_estate_inspection_jobs(organization_id,inspection_id,job_type,status,due_at,idempotency_key) values($1,$2,'reminder_24h','scheduled',now()-interval '1 minute','scheduler-a'),($3,$4,'reminder_24h','scheduled',now()-interval '1 minute','scheduler-b')",[A,IA,B,IB]);
  await assert.rejects(db.query('select * from set_real_estate_inspection_automation($1,$2,$3,$4)',[A,'enabled','operator-a',false]),/Explicit confirmation/);
  const enabled=(await db.query('select * from set_real_estate_inspection_automation($1,$2,$3,true)',[A,'enabled','operator-a'])).rows[0];assert.equal(enabled.status,'enabled');
  await db.query('select * from set_real_estate_inspection_automation($1,$2,$3,true)',[B,'paused','operator-b']);
  await assert.rejects(db.query('select * from set_real_estate_inspection_automation($1,$2,$3,true)',[C,'enabled','operator-c']),/active real-estate organization/);
  let due=(await db.query('select * from list_due_real_estate_inspection_organizations(25)')).rows.map(r=>r.organization_id);assert.deepEqual(due,[A]);
  await db.exec(`create function fail_audit() returns trigger language plpgsql as $$ begin if new.organization_id='${B}'::uuid then raise exception 'audit store unavailable'; end if; return new; end; $$; create trigger fail_fixture_b_audit before insert on audit_logs for each row execute function fail_audit();`);
  await assert.rejects(db.query('select * from set_real_estate_inspection_automation($1,$2,$3,true)',[B,'enabled','operator-b']),/audit store unavailable/);
  const unchanged=(await db.query('select status from real_estate_inspection_automation where organization_id=$1',[B])).rows[0];assert.equal(unchanged.status,'paused');
  await db.query('select * from set_real_estate_inspection_automation($1,$2,$3,true)',[A,'paused','operator-a']);
  due=(await db.query('select * from list_due_real_estate_inspection_organizations(25)')).rows;assert.deepEqual(due,[]);
  const audits=(await db.query('select organization_id,action from audit_logs order by created_at')).rows;assert.equal(audits.length,3);assert.equal(audits[0].action,'real_estate.inspection_automation.enabled');assert.equal(audits[2].action,'real_estate.inspection_automation.paused');
 }finally{await db.close();}
});

test('real PostgreSQL delivery callbacks reconcile by provider/message/tenant and never downgrade a newer receipt',async()=>{
 const db=await database();try{
  const JOB='a0000000-0000-4000-8000-000000000001',INS='a1000000-0000-4000-8000-000000000001',CUS='a2000000-0000-4000-8000-000000000001',PROPERTY='a3000000-0000-4000-8000-000000000001';
  await db.query('insert into crm_customers(id,organization_id,status) values($1,$2,$3)',[CUS,A,'active']);
  await db.query('insert into properties(id,organization_id,title,status) values($1,$2,$3,$4)',[PROPERTY,A,'Receipt fixture','active']);
  await db.query("insert into real_estate_inspections(id,organization_id,customer_id,property_id,property_verification_status,status,requested_start_at) values($1,$2,$3,$4,'verified','booked',now()+interval '2 days')",[INS,A,CUS,PROPERTY]);
  await db.query("insert into real_estate_inspection_jobs(id,organization_id,inspection_id,job_type,status,due_at,idempotency_key,provider,provider_message_id,delivery_status) values($1,$2,$3,'reminder_2h','completed',now(),'receipt-job','meta','meta-job-id','accepted')",[JOB,A,INS]);
  await db.query("insert into real_estate_outbound_tracking(organization_id,outbound_kind,idempotency_key,campaign_id,provider,provider_message_id,delivery_status) values($1,'campaign','receipt-a','fixture-campaign','meta','shared-message-id','accepted'),($2,'campaign','receipt-b','fixture-campaign','meta','shared-message-id','accepted')",[A,B]);
  const unmatched=(await db.query("select * from apply_real_estate_delivery_receipt('meta','missing-id','delivered',now(),null,null,null)")).rows[0];assert.equal(unmatched.event_status,'unmatched');
  const ambiguous=(await db.query("select * from apply_real_estate_delivery_receipt('meta','shared-message-id','delivered',now(),null,null,null)")).rows[0];assert.equal(ambiguous.applied,false);assert.equal(ambiguous.event_status,'ambiguous');
  const first=(await db.query("select * from apply_real_estate_delivery_receipt('meta','shared-message-id','delivered','2026-10-24T09:10:00Z',$1,null,null)",[A])).rows[0];assert.equal(first.applied,true);assert.equal(first.organization_id,A);assert.equal(first.delivery_status,'delivered');
  const old=(await db.query("select * from apply_real_estate_delivery_receipt('meta','shared-message-id','sent','2026-10-24T09:11:00Z',$1,null,null)",[A])).rows[0];assert.equal(old.applied,false);assert.equal(old.delivery_status,'delivered');
  const read=(await db.query("select * from apply_real_estate_delivery_receipt('meta','shared-message-id','read','2026-10-24T09:12:00Z',$1,null,null)",[A])).rows[0];assert.equal(read.applied,true);assert.equal(read.delivery_status,'read');
  const failed=(await db.query("select * from apply_real_estate_delivery_receipt('meta','shared-message-id','failed','2026-10-24T09:13:00Z',$1,'132000','late failure')",[A])).rows[0];assert.equal(failed.applied,false);assert.equal(failed.delivery_status,'read');
  const job=(await db.query('select organization_id,delivery_status,provider_message_id from real_estate_inspection_jobs where id=$1',[JOB])).rows[0];assert.equal(job.organization_id,A);assert.equal(job.delivery_status,'accepted');
  const jobReceipt=(await db.query("select * from apply_real_estate_delivery_receipt('meta','meta-job-id','sent','2026-10-24T09:20:00Z',$1,null,null)",[A])).rows[0];assert.equal(jobReceipt.applied,true);
  const completed=(await db.query('select status,delivery_status from real_estate_inspection_jobs where id=$1',[JOB])).rows[0];assert.equal(completed.status,'completed');assert.equal(completed.delivery_status,'sent');
  const wrongTenant=(await db.query("select * from apply_real_estate_delivery_receipt('meta','meta-job-id','delivered','2026-10-24T09:21:00Z',$1,null,null)",[B])).rows[0];assert.equal(wrongTenant.event_status,'unmatched');
  const duplicate=(await db.query("select * from apply_real_estate_delivery_receipt('meta','meta-job-id','sent','2026-10-24T09:20:00Z',$1,null,null)",[A])).rows[0];assert.equal(duplicate.event_status,'stale_or_duplicate');
 }finally{await db.close();}
});

test('estate catalog mutations and inspection requests commit their audit record atomically',async()=>{
 const db=await database();try{
  const created=(await db.query("select * from save_real_estate_estate_with_audit($1,$2,null,$3)",[A,'operator-a',{name:'Fixture estate',status:'published',knowledge_status:'approved',operating_instructions:'Call the office'}])).rows[0];assert.equal(created.name,'Fixture estate');const EST=created.id;
  await db.query('insert into properties(id,organization_id,title,status) values($1,$2,$3,$4)',[P,A,'Fixture listing','active']);
  const assigned=(await db.query('select * from assign_real_estate_property_with_audit($1,$2,$3,$4)',[A,'operator-a',P,EST])).rows[0];assert.equal(assigned.estate_id,EST);
  const faq=(await db.query('select * from save_real_estate_estate_faq_with_audit($1,$2,$3,null,$4)',[A,'operator-a',EST,{question:'When?',answer:'After closing.',category:'handover',sort_order:0}])).rows[0];assert.equal(faq.estate_id,EST);
  const faqTwo=(await db.query('select * from save_real_estate_estate_faq_with_audit($1,$2,$3,null,$4)',[A,'operator-a',EST,{question:'How?',answer:'By appointment.',category:'viewing',sort_order:1}])).rows[0];
  const reordered=(await db.query('select * from reorder_real_estate_estate_faqs_with_audit($1,$2,$3,$4)',[A,'operator-a',EST,[faqTwo.id,faq.id]])).rows;const firstFaq=reordered.find(row=>row.sort_order===0);assert.equal(firstFaq.id,faqTwo.id);
  await db.query('insert into knowledge_sources(id,organization_id,title,status,content) values($1,$2,$3,$4,$5)',[E,A,'Fixture pack','ready','approved content']);
  await db.query('select link_real_estate_knowledge_source_with_audit($1,$2,$3,$4,false)',[A,'operator-a',EST,E]);
  await db.query('select delete_real_estate_estate_faq_with_audit($1,$2,$3,$4)',[A,'operator-a',EST,faq.id]);
  const count=(await db.query('select count(*)::integer as n from audit_logs where organization_id=$1',[A])).rows[0].n;assert.equal(count,7);
  await assert.rejects(db.query('select * from save_real_estate_estate_with_audit($1,$2,$3,$4)',[B,'operator-b',EST,{name:'Wrong tenant update'}]),/Estate was not found/);
  await db.exec(`create function fail_real_estate_audit() returns trigger language plpgsql as $$ begin if new.organization_id='${B}'::uuid then raise exception 'audit write unavailable'; end if; return new; end; $$; create trigger fail_b_real_estate_audit before insert on audit_logs for each row execute function fail_real_estate_audit();`);
  await assert.rejects(db.query('select * from save_real_estate_estate_with_audit($1,$2,null,$3)',[B,'operator-b',{name:'Must roll back',status:'draft',knowledge_status:'draft'}]),/audit write unavailable/);
  const rolledBack=(await db.query("select count(*)::integer as n from real_estate_estates where organization_id=$1 and name='Must roll back'",[B])).rows[0].n;assert.equal(rolledBack,0);
  const countAfter=(await db.query('select count(*)::integer as n from audit_logs where organization_id=$1',[B])).rows[0].n;assert.equal(countAfter,0);
  const CUSTOMER='ba000000-0000-4000-8000-000000000001';await db.query('insert into crm_customers(id,organization_id,status) values($1,$2,$3)',[CUSTOMER,A,'active']);
  const requested=(await db.query("select * from create_real_estate_inspection_request_with_audit($1,$2,null,null,$3,null,'An unresolved property','unresolved',null,null,'Africa/Lagos','requested_verification','whatsapp','request-a',null,'{}'::jsonb)",[A,'customer:'+CUSTOMER,CUSTOMER])).rows[0];assert.equal(requested.status,'requested_verification');
  const reqAudit=(await db.query('select action,metadata->>\'actor_id\' as actor_id from audit_logs where resource_id=$1',[requested.id])).rows[0];assert.equal(reqAudit.action,'real_estate.inspection.requested');assert.equal(reqAudit.actor_id,'customer:'+CUSTOMER);
 }finally{await db.close();}
});

test('inspection transitions and cancellation update state atomically with operator audit',async()=>{
 const db=await database();try{
  const CUSTOMER='bb000000-0000-4000-8000-000000000001',INS='bb100000-0000-4000-8000-000000000001';
  await db.query('insert into crm_customers(id,organization_id,status) values($1,$2,$3)',[CUSTOMER,A,'active']);
  await db.query("insert into real_estate_inspections(id,organization_id,customer_id,property_query_text,property_verification_status,status,timezone) values($1,$2,$3,'Unknown property','unresolved','requested_verification','Africa/Lagos')",[INS,A,CUSTOMER]);
  const unavailable=(await db.query("select * from transition_real_estate_inspection_with_audit($1,$2,'unavailable',null,null,null,null,null,null,null,'No approved property',null,'operator-a',null)",[A,INS])).rows[0];assert.equal(unavailable.status,'unavailable');
  await db.exec("create function fail_all_audit() returns trigger language plpgsql as $$ begin raise exception 'audit store unavailable'; end; $$; create trigger fail_all_real_estate_audit before insert on audit_logs for each row execute function fail_all_audit();");
  await assert.rejects(db.query("select * from transition_real_estate_inspection_with_audit($1,$2,'requested',null,null,null,null,null,null,null,null,'Retry', 'operator-a',null)",[A,INS]),/audit store unavailable/);
  let state=(await db.query('select status from real_estate_inspections where organization_id=$1 and id=$2',[A,INS])).rows[0];assert.equal(state.status,'unavailable');
  await db.exec('drop trigger fail_all_real_estate_audit on audit_logs');
  const cancelled=(await db.query("select * from cancel_real_estate_inspection_with_audit($1,$2,'Operator cancelled','operator-a')",[A,INS])).rows[0];assert.equal(cancelled.status,'cancelled');
  const audit=(await db.query("select action,metadata->>'actor_id' as actor_id from audit_logs where resource_id=$1 order by created_at",[INS])).rows;assert.equal(audit.length,2);assert.equal(audit[0].action,'real_estate.inspection.transitioned');assert.equal(audit[0].actor_id,'operator-a');assert.equal(audit[1].action,'real_estate.inspection.cancelled');
 }finally{await db.close();}
});

test('real PostgreSQL campaign groups enforce tenant-owned CRM membership, RLS and atomic audit',async()=>{
 const db=await database();try{
  const LA='c0000000-0000-4000-8000-000000000001',LB='c0000000-0000-4000-8000-000000000002';
  await db.query('insert into leads(id,organization_id,name,status) values($1,$2,$3,$4),($5,$6,$7,$8)',[LA,A,'A lead','new',LB,B,'B lead','new']);
  const groupA=(await db.query("select * from save_real_estate_campaign_group_with_audit($1,$2,null,$3,'manual',$4,'{}'::jsonb,$5::uuid[])",[A,'operator-a','A manual group','A description',[LA]])).rows[0];
  assert.equal(groupA.organization_id,A);
  const memberA=(await db.query('select organization_id,group_id,lead_id from real_estate_campaign_group_members where group_id=$1',[groupA.id])).rows[0];
  assert.deepEqual(memberA,{organization_id:A,group_id:groupA.id,lead_id:LA});
  await assert.rejects(db.query("select * from save_real_estate_campaign_group_with_audit($1,$2,null,$3,'manual',$4,'{}'::jsonb,$5::uuid[])",[A,'operator-a','Cross lead group','',[LB]]),/Every campaign group member/);
  await assert.rejects(db.query("select * from save_real_estate_campaign_group_with_audit($1,$2,$3,$4,'manual',$5,'{}'::jsonb,$6::uuid[])",[B,'operator-b',groupA.id,'Cross-tenant update','',[LB]]),/not found in this organization/);
  const groupB=(await db.query("select * from save_real_estate_campaign_group_with_audit($1,$2,null,$3,'smart',$4,$5::jsonb,'{}'::uuid[])",[B,'operator-b','B smart group','B description',{state:'Lagos'}])).rows[0];
  assert.equal(groupB.organization_id,B);
  await db.exec(`SET test.organization='${A}';SET ROLE authenticated;`);
  const visible=(await db.query('select id,organization_id from real_estate_campaign_groups order by id')).rows;
  assert.deepEqual(visible.map(row=>row.organization_id),[A]);
  const memberVisible=(await db.query('select organization_id,lead_id from real_estate_campaign_group_members')).rows;
  assert.deepEqual(memberVisible.map(row=>row.lead_id),[LA]);
  await assert.rejects(db.query('insert into real_estate_campaign_groups(organization_id,name,group_type,created_by) values($1,$2,$3,$4)',[A,'forbidden','manual','operator-a']),/permission denied|row-level security/);
  await db.exec('RESET ROLE');
  await db.exec(`create function fail_campaign_group_audit() returns trigger language plpgsql as $$ begin if new.organization_id='${B}'::uuid then raise exception 'campaign group audit unavailable'; end if; return new; end; $$; create trigger fail_b_campaign_group_audit before insert on audit_logs for each row execute function fail_campaign_group_audit();`);
  await assert.rejects(db.query("select * from save_real_estate_campaign_group_with_audit($1,$2,null,$3,'smart',$4,$5::jsonb,'{}'::uuid[])",[B,'operator-b','Must roll back','',{interest:'duplex'}]),/campaign group audit unavailable/);
  const rolledBack=(await db.query("select count(*)::integer as n from real_estate_campaign_groups where organization_id=$1 and name='Must roll back'",[B])).rows[0].n;
  assert.equal(rolledBack,0);
  const audit=(await db.query("select count(*)::integer as n from audit_logs where organization_id=$1 and resource_type='real_estate_campaign_group'",[A])).rows[0].n;
  assert.equal(audit,1);
 }finally{await db.close();}
});

test('customer service windows are tenant-bound, monotonic and service-role-only',async()=>{
 const db=await database();try{
  const phone='2348012345678';
  const newer=new Date(Date.now()-10_000).toISOString();
  const older=new Date(Date.now()-60_000).toISOString();
  const first=(await db.query('select * from record_real_estate_customer_service_window($1,$2,$3,$4,$5)',[A,phone,'meta_whatsapp','meta-message-a',newer])).rows[0];
  assert.equal(first.applied,true);assert.equal(new Date(first.stored_at).toISOString(),new Date(newer).toISOString());
  const replay=(await db.query('select * from record_real_estate_customer_service_window($1,$2,$3,$4,$5)',[A,phone,'meta_whatsapp','meta-message-old',older])).rows[0];
  assert.equal(new Date(replay.stored_at).toISOString(),new Date(newer).toISOString());
  const secondTenant=(await db.query('select * from record_real_estate_customer_service_window($1,$2,$3,$4,$5)',[B,phone,'meta_whatsapp','meta-message-b',newer])).rows[0];
  assert.equal(secondTenant.applied,true);
  await assert.rejects(db.query('select * from record_real_estate_customer_service_window($1,$2,$3,$4,$5)',[C,phone,'meta_whatsapp','retail-message',newer]),/Active real-estate organization/);
  await assert.rejects(db.query('select * from record_real_estate_customer_service_window($1,$2,$3,$4,$5)',[A,'123','meta_whatsapp','bad-phone',newer]),/Invalid inbound service-window event/);
  await assert.rejects(db.query('select * from record_real_estate_customer_service_window($1,$2,$3,$4,$5)',[A,phone,'twilio_whatsapp','wrong-provider',newer]),/Invalid inbound service-window event/);
  const rows=(await db.query('select organization_id,phone_normalized,last_inbound_at from real_estate_customer_service_windows order by organization_id')).rows;
  assert.equal(rows.length,2);assert.deepEqual(rows.map((row)=>row.organization_id).sort(),[A,B].sort());
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('select * from record_real_estate_customer_service_window($1,$2,$3,$4,$5)',[A,phone,'meta_whatsapp','anon-message',newer]),/permission denied/);
  await assert.rejects(db.query('select * from real_estate_customer_service_windows'),/permission denied/);
  await db.exec('RESET ROLE; SET ROLE service_role');
  const service=(await db.query('select * from record_real_estate_customer_service_window($1,$2,$3,$4,$5)',[A,phone,'meta_whatsapp','service-message',new Date().toISOString()])).rows[0];
  assert.equal(service.applied,true);
  await db.exec('RESET ROLE');
 }finally{await db.close();}
});
