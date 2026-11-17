/* eslint-disable @typescript-eslint/no-require-imports */
/* Synthetic local-only server. No production keys or provider credentials are inherited. */
const http = require('node:http');
const {spawn} = require('node:child_process');
const {fixture} = require('./fixture-data.cjs');
const fixturePort = 4401;
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const readRpc = request.method === 'POST' && url.pathname === '/rest/v1/rpc/hotel_tenant_inventory_readiness';
  if (request.method !== 'GET' && !readRpc) {
    response.writeHead(405, {'Content-Type':'application/json'});
    return response.end(JSON.stringify({message:'Fixture disallows writes and external automation.'}));
  }
  let result = fixture(url);
  const count = Array.isArray(result) ? result.length : 1;
  if (request.headers.accept?.includes('application/vnd.pgrst.object+json')) result = Array.isArray(result) ? result[0] || null : result;
  response.writeHead(200, {'Content-Type':'application/json','Content-Range':`0-${Math.max(0,count-1)}/${count}`});
  response.end(JSON.stringify(result));
});
server.listen(fixturePort, '127.0.0.1', () => {
  const env = Object.fromEntries(['PATH','HOME','TMPDIR','NODE_EXTRA_CA_CERTS'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
  Object.assign(env, {NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',
    SUPABASE_URL:`http://127.0.0.1:${fixturePort}`,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${fixturePort}`,
    SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-key',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-test-key',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-test-key',
    ADMIN_SESSION_SECRET:'synthetic-local-test-secret',CLIENT_SESSION_SECRET:'synthetic-local-test-secret',
    LIMITLESS_ADMIN_EMAIL:'admin@example.test',LIMITLESS_ADMIN_PASSWORD:'synthetic-local-password'});
  const app = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','4400','--hostname','127.0.0.1'],{env,stdio:'inherit'});
  const stop = () => {app.kill('SIGTERM');server.close();};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  app.on('exit',code=>{server.close();process.exitCode=code||0;});
});
