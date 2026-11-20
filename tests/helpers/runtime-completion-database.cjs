/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const f=require('./communication-outcome-database.cjs');
const file=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_runtime_execution_completion_recovery.sql'));
const completionSQL=fs.readFileSync('supabase/migrations/'+file,'utf8');
async function fixture(t){const db=new PGlite();t.after(()=>db.close());await db.exec(f.rolesSQL);await db.exec(f.schemaSQL);await db.exec(completionSQL);await db.exec(f.seedSQL);return db;}
function input(extra={}){return{p_organization_id:f.org,p_agent_id:f.agent,p_execution_id:f.execution,p_status:'succeeded',p_output:{action_results:[{status:'queued'}]},p_error_code:null,p_error_message:null,...extra};}
async function complete(db,extra={}){return(await db.query('select public.complete_runtime_execution($1,$2,$3,$4,$5,$6,$7) result',Object.values(input(extra)))).rows[0].result;}
async function parent(db){await db.query("insert into command_queue(organization_id,agent_id,execution_id,command_type) values($1,$2,$3,'agent.respond'),($1,$2,$3,'email.send_message'),($1,$2,$3,'appointment.create'),($1,$2,$3,'follow_up.schedule')",[f.org,f.agent,f.execution]);}
module.exports={...f,fixture,input,complete,parent,completionSQL};
