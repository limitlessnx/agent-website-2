/* eslint-disable @typescript-eslint/no-require-imports */
// Executes the actual Supabase-style predicates/upserts against an isolated SQL DB.
const assert=require('node:assert/strict');
const ident=s=>{assert.match(s,/^[a-z_][a-z0-9_]*$/);return '"'+s+'"';};
module.exports=function adapter(db,{failProgress=()=>false,failIntegration=()=>false}={}){return {from(table){const filters=[];let columns='*',value,operation='read',conflict;const q={
 select(s='*'){columns=s;return q},eq(k,v){filters.push({k,v});return q},in(k,v){filters.push({k,v,array:true});return q},limit(){return q},
 insert(v){operation='insert';value=v;return q},upsert(v,options){assert.equal(options.ignoreDuplicates,true);conflict=options.onConflict;operation='insert';value=v;return q},
 async execute(single=false){try{if(table==='runtime_progress_events'&&operation==='insert'&&failProgress())throw Error('synthetic progress outage');if(table==='organization_integrations'&&failIntegration())throw Error('synthetic integration outage');
 const params=[];let sql;
 if(operation==='insert'){const keys=Object.keys(value).filter(k=>value[k]!==undefined);params.push(...keys.map(k=>value[k]));sql=`insert into ${ident(table)}(${keys.map(ident).join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')})`+(conflict?` on conflict(${conflict.split(',').map(ident).join(',')}) do nothing`:'')+` returning ${columns==='*'?'*':columns.split(',').map(ident).join(',')}`;}
 else {sql=`select ${columns==='*'?'*':columns.split(',').map(ident).join(',')} from ${ident(table)}`;if(filters.length)sql+=' where '+filters.map(f=>{params.push(f.v);return ident(f.k)+(f.array?`=any($${params.length}::text[])`:`=$${params.length}`)}).join(' and ');sql+=' limit 1';}
 const rows=(await db.query(sql,params)).rows;return {data:single?(rows[0]||null):rows,error:null};
 }catch(error){return {data:null,error}}},single(){return q.execute(true)},maybeSingle(){return q.execute(true)},then(resolve,reject){return q.execute().then(resolve,reject)}
 };return q;}};};
