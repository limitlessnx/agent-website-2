import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {bootstrap,migration,seed,org,owner,manager,newcomer,another,invite,request,approve,accept} from './helpers/team-access-database.mjs';

const container=process.env.TEAM_TEST_DOCKER_CONTAINER;
function sql(query){return new Promise((resolve,reject)=>{
 const child=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','flux_team_test']);
 let out='',err='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);child.on('error',reject);child.on('close',code=>code?reject(new Error(err)):resolve(out.trim()));child.stdin.end(query);
});}

test('PostgreSQL 17 concurrent tenant-seat transitions',{skip:!container},async t=>{
 await sql(bootstrap+migration+seed);
 const reset=()=>sql(`delete from audit_logs;delete from organization_access_requests;delete from organization_invitations;delete from membership_roles where membership_id in(select id from organization_memberships where user_id in('${newcomer}','${another}') and organization_id='${org}');delete from organization_memberships where user_id in('${newcomer}','${another}') and organization_id='${org}';update organizations set seat_limit=3 where id='${org}';update organization_memberships set status='active' where user_id='${manager}';`);
 const race=async(first,second)=>{
   // The first transaction owns the actual organization lock while the second queues.
   const one=sql(`begin;select pg_advisory_xact_lock(hashtextextended('${org}',187));select pg_sleep(0.4);${first};commit;`);
   await new Promise(r=>setTimeout(r,100));
   const two=sql(second);
   const results=await Promise.allSettled([one,two]);
   assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
   assert.match(results.find(x=>x.status==='rejected').reason.message,/seat limit/);
   assert.equal(await sql(`select (select count(*) from organization_memberships where organization_id='${org}' and status in('active','suspended'))+(select count(*) from organization_invitations where organization_id='${org}' and status='pending' and expires_at>now())`),'3');
 };
 await t.test('two email invitations compete for last seat',async()=>{await reset();await race(invite(),invite('another@example.test','b'.repeat(64)));});
 await t.test('email invitation and Access ID approval share the same lock',async()=>{await reset();const id=await sql(request(another));await race(invite(),approve(id));});
 await t.test('two Access ID approvals compete for last seat',async()=>{await reset();const a=await sql(request()),b=await sql(request(another));await race(approve(a),approve(b));});
 await t.test('reactivation cannot race a new invitation past limit',async()=>{
   await reset();await sql(`insert into organization_memberships(organization_id,user_id,status) values('${org}','${newcomer}','removed');`);
   const mid=await sql(`select id from organization_memberships where user_id='${newcomer}' and organization_id='${org}'`);
   await race(invite('another@example.test'),`select update_organization_member_access('${org}','${owner}','${mid}',null,'active')`);
 });
 await t.test('parallel acceptance converts existing reservations without exceeding allowance',async()=>{
   await reset();await sql(`update organizations set seat_limit=4 where id='${org}'`);await sql(invite());await sql(invite('another@example.test','b'.repeat(64)));
   await Promise.all([sql(accept()),sql(accept(another,'another@example.test','b'.repeat(64)))]);
   assert.equal(await sql(`select count(*) from organization_memberships where organization_id='${org}' and status='active'`),'4');
 });
});
