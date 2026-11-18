import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {schemaSQL,parameters,org,agent} from './helpers/elevenlabs-receipt-database.mjs';

const container=process.env.ELEVENLABS_TEST_DOCKER_CONTAINER;
let command,args,env;
if(container){
 assert.ok(/^flux-phase6-/.test(container)||container==='flux-team-access-final','Only an explicitly isolated test container is allowed');
 assert.equal(execFileSync('docker',['inspect','-f','{{.HostConfig.NetworkMode}}',container],{encoding:'utf8'}).trim(),'none');
 command='docker';args=['exec','-i',container,'psql','-X','-At','-v','ON_ERROR_STOP=1','-U','postgres','-d','receipt_test'];env=process.env;
}else{
 const url=new URL(process.env.ELEVENLABS_TEST_DATABASE_URL||'');
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/receipt_test','Refusing any non-local or non-test database');
 command='psql';args=['-X','-At','-v','ON_ERROR_STOP=1','-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d','receipt_test'];
 env={...process.env,PGPASSWORD:decodeURIComponent(url.password)};
}
function run(sql,app='receipt-audit'){
 const child=spawn(command,args,{env});let stdout='',stderr='';
 child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);
 child.stdin.end(`set application_name='${app}';\n${sql}\n`);
 return new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve({code,stdout:stdout.trim(),stderr}));});
}
async function ok(sql,app){const r=await run(sql,app);assert.equal(r.code,0,r.stderr);return r.stdout.split('\n').filter(x=>x!=='SET').join('\n');}
assert.equal(await ok("select count(*) from information_schema.tables where table_schema='public'"),'0','Test database must be empty');
await ok(schemaSQL());
const quote=value=>value===null?'null':"'"+String(value).replaceAll("'","''")+"'";
function apply(args){return 'select apply_elevenlabs_voice_receipt('+args.map(quote).join(',')+');';}
function receipt(args){return `insert into elevenlabs_voice_webhook_events(event_key,event_type,conversation_id,payload) values(${quote(args[0])},'post_call_transcription',${quote(args[5])},${quote(args[1])}::jsonb);`;}
async function barrier(app){
 for(let n=0;n<40;n++){if(await ok(`select count(*) from pg_stat_activity where datname='receipt_test' and application_name='${app}' and wait_event='PgSleep'`)==='1')return;await delay(50);}
 throw Error('Writer never reached the transaction barrier');
}
async function scenario(name,differentEvent=false,crash=false){
 await ok(`truncate elevenlabs_voice_webhook_events,elevenlabs_voice_calls,handoff_requests,agent_conversations,flux_credit_ledger cascade;update flux_credit_wallets set balance=1000,status='active';`);
 const a=parameters({key:name+'-a',transfer:true});const b=differentEvent?parameters({key:name+'-b',transfer:true}):a;
 await ok(receipt(a)+(differentEvent?receipt(b):''));
 const holder='receipt-holder-'+name;
 const first=run('begin;'+apply(a)+`select pg_sleep(${crash?30:1});commit;`,holder);
 await barrier(holder);
 const second=run(apply(b),'receipt-contender-'+name);
 if(crash){await delay(150);await ok(`select pg_terminate_backend(pid) from pg_stat_activity where datname='receipt_test' and application_name='${holder}'`);}
 const [one,two]=await Promise.all([first,second]);
 assert.equal(two.code,0,two.stderr);
 if(crash)assert.notEqual(one.code,0);else assert.equal(one.code,0,one.stderr);
 assert.equal(await ok('select count(*) from flux_credit_ledger'),'1');
 assert.equal(await ok('select count(*) from handoff_requests'),'1');
 assert.equal(await ok('select count(*) from elevenlabs_voice_calls'),'1');
 assert.equal(await ok(`select balance from flux_credit_wallets where organization_id='${org}'`),'958');
 assert.equal(await ok('select count(*) from elevenlabs_voice_webhook_events where processed_at is not null'),differentEvent?'2':'1');
 console.log('PASS '+name+': one debit, one handoff, committed completion');
}
await scenario('same-event');
await scenario('same-call-different-events',true);
await scenario('interrupted-transaction',false,true);
const mapping=parameters({key:'mapping-held',call:'mapping-call'});await ok(receipt(mapping));
const mappingHolder=run('begin;'+apply(mapping)+'select pg_sleep(2);commit;','receipt-mapping-holder');
await barrier('receipt-mapping-holder');
const mappingWriter=run(`update agents set configuration='{"elevenlabs_agent_id":"changed-provider"}' where id='${agent}';`,'receipt-mapping-writer');
let blocked=false;
for(let n=0;n<15;n++){if(await ok("select count(*) from pg_stat_activity where datname='receipt_test' and application_name='receipt-mapping-writer' and wait_event_type='Lock'")==='1'){blocked=true;break;}await delay(30);}
assert.ok(blocked,'Agent mapping must remain locked until receipt settlement commits');
for(const r of await Promise.all([mappingHolder,mappingWriter]))assert.equal(r.code,0,r.stderr);
console.log('PASS mapping-change: tenant binding remains locked through settlement');
console.log('4 real PostgreSQL concurrency/recovery scenarios passed; no external provider or production database used');
