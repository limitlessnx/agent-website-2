/* eslint-disable @typescript-eslint/no-require-imports */
// Local synthetic browser fixture. Never inherit provider keys or production URLs.
const http=require('node:http'),{spawn}=require('node:child_process');
const {fixture}=require('../responsive/fixture-data.cjs');
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'){res.writeHead(405);return res.end('Fixture refuses backend writes');}
 const url=new URL(req.url,'http://127.0.0.1:4701');
 const data=fixture(url);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));
});
server.listen(4701,'127.0.0.1',()=>{
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','NODE_EXTRA_CA_CERTS'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 Object.assign(env,{NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',SUPABASE_URL:'http://127.0.0.1:4701',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4701',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-test-key',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-test-key',SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-key',CLIENT_SESSION_SECRET:'synthetic-manager-onboarding-only',ADMIN_SESSION_SECRET:'synthetic-manager-onboarding-only'});
 const app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','4700','--hostname','127.0.0.1'],{env,stdio:'inherit'});
 const stop=()=>{app.kill('SIGTERM');server.close();};process.on('SIGTERM',stop);process.on('SIGINT',stop);app.on('exit',code=>{server.close();process.exitCode=code||0;});
});
