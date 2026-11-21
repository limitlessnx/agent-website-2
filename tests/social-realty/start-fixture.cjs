/* eslint-disable @typescript-eslint/no-require-imports */
const http=require('node:http'),{spawn}=require('node:child_process');
const {fixture}=require('../responsive/fixture-data.cjs');
const org='b15f21b4-5697-4d21-9421-8a34eae3476d',flux='15046426-e520-438b-8694-7662a6986efb';
const brand={id:'ac000000-0000-4000-8000-000000000001',organization_id:org,slug:'limitless-realty',name:'Limitless Realty',tone:'Practical',audience:'Nigerian property buyers',content_pillars:['Buyer education'],products:[],ctas:['Message Limitless Realty for an inspection.'],visual_rules:{},metadata:{strategy_profile:'nigerian-real-estate-v1',daily_publishing:{enabled:false},weekly_review_enabled:false}};
let configured=true,fail=false,posts=[],calls=0,audits=[];
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');let data=[];
  const send=(status,result)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(result));};
  const body=async()=>{let s='';for await(const b of req)s+=b;return JSON.parse(s||'{}');};
  if(url.pathname==='/__qa/reset'){configured=url.searchParams.get('configured')!=='0';fail=false;posts=[];calls=0;audits=[];return send(200,{ok:true});}
  if(url.pathname==='/__qa/fail'){fail=url.searchParams.get('value')==='1';return send(200,{fail});}
  if(url.pathname==='/__qa/state')return send(200,{posts,calls,audits});
  if(url.pathname==='/__qa/responses'){
    calls++;const input=await body();await new Promise(r=>setTimeout(r,300));if(fail)return send(503,{error:'Synthetic provider outage'});
    if(input.tools)return send(200,{output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://example.test/nigeria-property-report',title:'Synthetic Nigerian property report'}]}},{type:'message',content:[{type:'output_text',text:'Synthetic recent reporting for fixture verification; not actual news.'}]}]});
    const request=JSON.parse(input.input[1].content),research=request.mode==='research';
    const generated=Array.from({length:research?3:1},(_,i)=>({title:`Synthetic property education draft ${i+1}`,hook:'Questions to ask before an inspection',caption:'Ask about available documents and arrange an inspection. Message Limitless Realty. #NigerianRealEstate',cta:'Message Limitless Realty for an inspection.',visual_brief:'Illustrative checklist, not a real listing.',source_urls:research?['https://example.test/nigeria-property-report']:[]}));
    return send(200,{output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({posts:generated})}]}]});
  }
  if(url.pathname==='/rest/v1/social_posts'&&req.method==='POST'){
    const rows=await body();for(const row of Array.isArray(rows)?rows:[rows])if(!posts.some(p=>p.id===row.id))posts.push({...row,created_at:new Date().toISOString()});return send(201,[]);
  }
  if(url.pathname==='/rest/v1/social_brands'&&req.method==='POST'){configured=true;await body();return send(201,[]);}
  if(url.pathname==='/rest/v1/audit_logs'&&req.method==='POST'){audits.push(await body());return send(201,[]);}
  if(req.method!=='GET'&&req.method!=='HEAD')return send(405,{message:'Synthetic fixture rejects production writes'});
  const table=url.pathname.split('/').pop(),filter=url.searchParams.get('organization_id')||'';
  if(table==='organizations'){
    const isFlux=(url.searchParams.get('slug')||'').includes('fluxknight')||filter.includes(flux);
    data=[{id:isFlux?flux:org,name:isFlux?'Fluxknight':'Limitless Realty',slug:isFlux?'fluxknight':'limitless-realty',status:'active',metadata:{industry:'real-estate'}}];
  }else if(table==='social_brands')data=filter.includes(flux)?[{...brand,id:'a330b65a-d5b2-45f3-b211-451616f2fa8d',organization_id:flux,name:'Fluxknight',slug:'fluxknight',metadata:{}}]:configured?[brand]:[];
  else if(table==='social_posts'){
    data=posts.filter(p=>filter.includes(p.organization_id));
    const request=url.searchParams.get('metadata->>realty_request_id');if(request)data=data.filter(p=>request==='eq.'+p.metadata.realty_request_id);
  }else if(table.startsWith('social_')||table==='organization_integrations')data=[];
  else data=fixture(url);
  if(req.headers.accept?.includes('application/vnd.pgrst.object+json'))data=Array.isArray(data)?data[0]||null:data;
  return send(200,data);
});
server.listen(4401,'127.0.0.1',()=>{
  const env=Object.fromEntries(['PATH','HOME','TMPDIR','NODE_EXTRA_CA_CERTS'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  Object.assign(env,{NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',SUPABASE_URL:'http://127.0.0.1:4401',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4401',SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-key',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-test-key',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-test-key',ADMIN_SESSION_SECRET:'synthetic-local-test-secret',CLIENT_SESSION_SECRET:'synthetic-local-test-secret',LIMITLESS_ADMIN_EMAIL:'admin@example.test',LIMITLESS_ADMIN_PASSWORD:'synthetic-password',OPENAI_API_KEY:'synthetic-no-live-provider'});
  const app=spawn(process.execPath,['--require','./tests/social-realty/provider-mock.cjs','node_modules/next/dist/bin/next','dev','--port','4400','--hostname','127.0.0.1'],{env,stdio:'inherit'});
  const stop=()=>{app.kill('SIGTERM');server.close();};process.on('SIGTERM',stop);process.on('SIGINT',stop);app.on('exit',code=>{server.close();process.exitCode=code||0;});
});
