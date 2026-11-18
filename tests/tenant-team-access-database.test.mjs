import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { bootstrap,migration,seed,org,otherOrg,owner,manager,newcomer,another,invite,accept,request,approve } from './helpers/team-access-database.mjs';

test('reviewed manager migration enforces real database behavior',async t=>{
 const db=new PGlite();
 await db.exec(bootstrap); await db.exec(migration); await db.exec(seed);
 const run=async(sql)=>{await db.exec('savepoint checked_query');try{const result=(await db.query(sql)).rows;await db.exec('release savepoint checked_query');return result;}catch(error){await db.exec('rollback to savepoint checked_query');await db.exec('release savepoint checked_query');throw error;}};
 const scenario=async(name,fn)=>t.test(name,async()=>{await db.exec('begin');try{await fn();}finally{await db.exec('rollback');}});
 try{
 await scenario('migration is repeatable and preserves seeded operational permissions',async()=>{
   await db.exec(migration);
   const keys=(await run(`select p.key from role_permissions rp join roles r on r.id=rp.role_id join permissions p on p.id=rp.permission_id where r.organization_id='${org}' and r.slug='manager'`)).map(x=>x.key);
   assert.ok(keys.includes('customers.manage'));assert.ok(keys.includes('appointments.manage'));assert.ok(keys.includes('members.view'));assert.ok(!keys.includes('members.manage'));assert.ok(!keys.includes('billing.manage'));
 });
 await scenario('manager and cross-tenant owner cannot invite',async()=>{
   await assert.rejects(run(invite(undefined,undefined,manager)),/Not authorized/);
 });
 await scenario('owner invitation reserves last seat and acceptance consumes exactly one',async()=>{
   await run(invite());await run(accept());
   assert.equal((await run(`select count(*)::int n from organization_memberships where organization_id='${org}' and status='active'`))[0].n,3);
   assert.equal((await run(`select status from organization_invitations`))[0].status,'accepted');
   assert.equal((await run(`select action from audit_logs where actor_user_id='${newcomer}'`))[0].action,'organization.member_joined');
 });
 await scenario('seat exhaustion prevents another invitation',async()=>{await run(invite());await assert.rejects(run(invite('another@example.test','b'.repeat(64))),/seat limit/);});
 await scenario('email mismatch, expired token, revoked token cannot join',async()=>{
   await run(invite());await assert.rejects(run(accept(another,'another@example.test')),/does not match/);
 });
 await scenario('expired invitation releases capacity even if its stored status is pending',async()=>{
   await run(invite());await db.exec(`update organization_invitations set expires_at=now()-interval '1 hour'`);
   await assert.rejects(run(accept()),/expired/);await run(invite('another@example.test','b'.repeat(64)));
 });
 await scenario('revocation is owner-only and releases capacity',async()=>{
   await run(invite());const id=(await run('select id from organization_invitations'))[0].id;
   await assert.rejects(run(`select revoke_organization_invitation('${org}','${manager}','${id}')`),/Not authorized/);
   await run(`select revoke_organization_invitation('${org}','${owner}','${id}')`);await assert.rejects(run(accept()),/invalid|no longer/);await run(invite('another@example.test','b'.repeat(64)));
 });
 await scenario('acceptance rechecks quota after plan downgrade',async()=>{await run(invite());await db.exec(`update organizations set seat_limit=2 where id='${org}'`);await assert.rejects(run(accept()),/seat limit/);});
 await scenario('acceptance requires still-active inviting owner',async()=>{await run(invite());await db.exec(`update organization_memberships set status='removed' where user_id='${owner}'`);await assert.rejects(run(accept()),/no longer authorized/);});
 await scenario('Access ID alone creates no membership, approval requires owner and audits outcome',async()=>{
   const id=(await run(request()))[0].id;assert.equal((await run(`select count(*)::int n from organization_memberships where user_id='${newcomer}'`))[0].n,0);
   await assert.rejects(run(approve(id,manager)),/admin access/);await run(approve(id));
   assert.equal((await run(`select action from audit_logs where resource_id='${id}'`))[0].action,'organization.access_request_approved');
 });
 await scenario('approval cannot cross organizations',async()=>{const id=(await run(request(newcomer,otherOrg)))[0].id;await assert.rejects(run(approve(id)),/admin access/);});
 await scenario('legacy admin and foreign owner role cannot approve access',async()=>{
   await db.exec(`insert into roles(organization_id,slug) values('${org}','admin');insert into membership_roles select m.id,r.id,now() from organization_memberships m join roles r on r.organization_id='${otherOrg}' and r.slug='owner' where m.user_id='${manager}';`);
   const id=(await run(request()))[0].id;await assert.rejects(run(approve(id,manager)),/admin access/);
 });
 await scenario('approval converts matching invitation reservation without double counting',async()=>{
   await run(invite());const id=(await run(request()))[0].id;await run(approve(id));
   assert.equal((await run('select status from organization_invitations'))[0].status,'revoked');
   assert.equal((await run(`select count(*)::int n from organization_memberships where organization_id='${org}' and status='active'`))[0].n,3);
 });
 await scenario('unrelated reservations block Access ID approval',async()=>{await run(invite('another@example.test'));const id=(await run(request()))[0].id;await assert.rejects(run(approve(id)),/seat limit/);});
 await scenario('removed privileged membership is replaced with manager, owner is protected',async()=>{
   await db.exec(`insert into organization_memberships(organization_id,user_id,status) values('${org}','${newcomer}','removed'); insert into roles(organization_id,slug) values('${org}','admin'); insert into membership_roles select m.id,r.id,now() from organization_memberships m join roles r on r.organization_id=m.organization_id and r.slug='admin' where m.user_id='${newcomer}';`);
   const id=(await run(request()))[0].id;await run(approve(id));
   assert.deepEqual((await run(`select r.slug from membership_roles mr join roles r on r.id=mr.role_id join organization_memberships m on m.id=mr.membership_id where m.user_id='${newcomer}'`)).map(x=>x.slug),['manager']);
 });
 await scenario('removed owner cannot regain ownership via manager approval',async()=>{
   await db.exec(`insert into organization_memberships(organization_id,user_id,status) values('${org}','${newcomer}','removed'); insert into membership_roles select m.id,r.id,now() from organization_memberships m join roles r on r.organization_id=m.organization_id and r.slug='owner' where m.user_id='${newcomer}';`);
   const id=(await run(request()))[0].id;await assert.rejects(run(approve(id)),/Owner access/);
 });
 await scenario('owner reactivation cannot bypass ownership transfer through the membership RPC',async()=>{
   await db.exec(`insert into organization_memberships(organization_id,user_id,status) values('${org}','${newcomer}','removed');insert into membership_roles select m.id,r.id,now() from organization_memberships m join roles r on r.organization_id=m.organization_id and r.slug='owner' where m.user_id='${newcomer}';`);
   const mid=(await run(`select id from organization_memberships where user_id='${newcomer}'`))[0].id;
   await assert.rejects(run(`select update_organization_member_access('${org}','${owner}','${mid}',null,'active')`),/ownership transfer/);
 });
 await scenario('reactivation of removed member checks reserved capacity; suspension retains seat',async()=>{
   const mid=(await run(`select id from organization_memberships where user_id='${manager}'`))[0].id;
   await run(`select update_organization_member_access('${org}','${owner}','${mid}',null,'removed')`);
   await run(invite());await run(invite('another@example.test','b'.repeat(64)));
   await assert.rejects(run(`select update_organization_member_access('${org}','${owner}','${mid}',null,'active')`),/seat limit/);
 });
 await scenario('role customization cannot delegate team, billing or owner powers; view and operations allowed',async()=>{
   for(const key of ['members.manage','billing.manage','organization.owner.transfer'])await assert.rejects(run(`select set_organization_role_permissions('${org}','${owner}','manager',array['${key}'])`),/reserved/);
   await run(`select set_organization_role_permissions('${org}','${owner}','manager',array['members.view','billing.view','customers.manage'])`);
 });
 await scenario('rejection audits and leaves membership absent',async()=>{
   const id=(await run(request()))[0].id;await run(`select reject_organization_access_request('${id}','${owner}')`);
   assert.equal((await run(`select action from audit_logs where resource_id='${id}'`))[0].action,'organization.access_request_rejected');
   assert.equal((await run(`select count(*)::int n from organization_memberships where user_id='${newcomer}'`))[0].n,0);
 });
 await scenario('public/authenticated roles cannot execute privileged RPCs or direct table mutations',async()=>{
   for(const role of ['anon','authenticated']){
     for(const fn of ['approve_organization_access_request(uuid,uuid)','create_organization_invitation(uuid,uuid,text,text,text,timestamptz)','accept_organization_invitation(uuid,text,text)','update_organization_member_access(uuid,uuid,uuid,text,text)'])assert.equal((await run(`select has_function_privilege('${role}','${fn}','EXECUTE') allowed`))[0].allowed,false);
     for(const table of ['organization_memberships','membership_roles','roles','role_permissions','organization_invitations','organization_access_requests'])for(const permission of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await run(`select has_table_privilege('${role}','${table}','${permission}') allowed`))[0].allowed,false);
   }
 });
 }finally{await db.close();}
});
