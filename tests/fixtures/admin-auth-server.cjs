/* eslint-disable @typescript-eslint/no-require-imports */
const http=require('node:http');const {spawn}=require('node:child_process');const {createHmac}=require('node:crypto');
const ownerId='10000000-0000-4000-8000-000000000001';const tenantId='10000000-0000-4000-8000-000000000002';let active=true;
function user(id){return{id,aud:'authenticated',role:'authenticated',email:id===ownerId?'owner@example.test':'tenant@example.test',email_confirmed_at:'2026-11-01T00:00:00Z',created_at:'2026-11-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{role:'super_admin'}};}
function jwt(id){const now=Math.floor(Date.now()/1000);const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const body=Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',email:user(id).email,iat:now,exp:now+3600,iss:'http://127.0.0.1:4601/auth/v1'})).toString('base64url');return head+'.'+body+'.'+createHmac('sha256','synthetic-only').update(head+'.'+body).digest('base64url');}
function respond(res,status,body){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');let raw='';for await(const chunk of req)raw+=chunk;let body={};try{body=JSON.parse(raw)}catch{}
 if(url.pathname==='/__qa/active'&&req.method==='POST'){active=body.active===true;return respond(res,200,{ok:true});}
 if(url.pathname==='/auth/v1/token'&&req.method==='POST'){
  if(!['owner@example.test','tenant@example.test'].includes(body.email)||body.password!=='synthetic-password')return respond(res,400,{error:'invalid_grant',error_description:'Invalid login credentials.'});
  const id=body.email==='owner@example.test'?ownerId:tenantId;return respond(res,200,{access_token:jwt(id),refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:user(id)});
 }
 if(url.pathname==='/auth/v1/user'){
  try{const token=String(req.headers.authorization||'').replace(/^Bearer /,'');const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));if([ownerId,tenantId].includes(claims.sub))return respond(res,200,user(claims.sub));}catch{}
  return respond(res,401,{message:'Invalid synthetic session'});
 }
 if(url.pathname==='/auth/v1/admin/users')return respond(res,200,{users:[user(ownerId),user(tenantId)]});
 if(url.pathname==='/auth/v1/logout')return respond(res,503,{message:'Deliberate synthetic provider outage'});
 if(req.method!=='GET')return respond(res,405,{message:'Fixture denies database writes and communications.'});
 const table=url.pathname.split('/').pop();let data=table==='platform_super_admins'&&url.searchParams.get('user_id')===`eq.${ownerId}`&&active?[{user_id:ownerId,status:'active'}]:[];
 if(req.headers.accept?.includes('application/vnd.pgrst.object+json'))data=data[0]||null;
 return respond(res,200,data);
});
server.listen(4601,'127.0.0.1',()=>{
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','NODE_EXTRA_CA_CERTS'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
 Object.assign(env,{NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',SUPABASE_URL:'http://127.0.0.1:4601',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4601',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-publishable-key',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-publishable-key'});
 const app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','4600'],{env,stdio:'inherit'});
 const stop=()=>{app.kill('SIGTERM');server.close();};process.on('SIGINT',stop);process.on('SIGTERM',stop);app.on('exit',code=>{server.close();process.exitCode=code||0;});
});
