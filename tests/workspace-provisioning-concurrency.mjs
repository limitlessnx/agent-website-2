import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const url = new URL(process.env.WORKSPACE_TEST_DATABASE_URL || '');
assert.ok(['127.0.0.1','localhost'].includes(url.hostname) && url.pathname === '/workspace_test', 'Disposable localhost workspace_test only');
function query(sql, name='workspace-test') {
  return new Promise(resolve=>{
    const child=spawn('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',url.toString()],{env:{...process.env,PGAPPNAME:name},stdio:['pipe','pipe','pipe']});
    let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
    child.on('error',e=>resolve({code:1,out,err:e.message}));child.on('close',code=>resolve({code,out:out.trim(),err}));child.stdin.end(sql);
  });
}
async function ok(sql,name){const r=await query(sql,name);assert.equal(r.code,0,r.err);return r.out;}
assert.equal(await ok("SELECT count(*) FROM pg_tables WHERE schemaname='public';"),'0');
for(const path of ['tests/fixtures/workspace-provisioning-postgres.sql','supabase/migrations/20261025211315_20261024141900_client_provisioning_retry_safe.sql','supabase/migrations/20261024140349_workspace_provisioning_acl.sql','supabase/migrations/20261125195017_preserve_workspace_state_on_provisioning_retry.sql']) await ok(readFileSync(path,'utf8'));
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const call=(user,industry)=>"SELECT public.provision_client_workspace('"+user+"','Concurrent Hotel','concurrent-hotel','"+industry+"','owner@example.test')->>'organization_id';";
const holder=query("BEGIN; "+call(a,'hotels')+" SELECT pg_sleep(4); COMMIT;",'workspace-holder');
let sleeping=false;
for(let i=0;i<50;i++){if(await ok("SELECT count(*) FROM pg_stat_activity WHERE application_name='workspace-holder' AND wait_event='PgSleep';")==='1'){sleeping=true;break;}await sleep(100);}
assert.ok(sleeping,'first independent transaction must hold provisioning locks');
const [first,retry,conflict]=await Promise.all([holder,query(call(a,'hotels'),'workspace-retry'),query(call(a,'real-estate'),'workspace-conflict')]);
assert.equal(first.code,0,first.err);assert.equal(retry.code,0,retry.err);assert.equal(first.out.split('\n')[0],retry.out);
assert.notEqual(conflict.code,0);assert.match(conflict.err,/industry/i);
assert.equal(await ok("SELECT count(*) FROM organizations; SELECT count(*) FROM organization_memberships; SELECT count(*) FROM client_onboarding_profiles; SELECT count(*) FROM flux_credit_wallets;"),'1\n1\n1\n1');
assert.notEqual(await ok(call(b,'hotels')),retry.out);
assert.equal(await ok("SELECT count(DISTINCT slug) FROM organizations;"),'2');
console.log('PASS: independent concurrent transactions, conflict rejection, single workspace and distinct slugs');
