import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");

test("Twilio parent health check uses the parent Account SID and API key credentials",()=>{
  const provider=read("lib/twilio-whatsapp.ts");
  assert.match(provider,/TWILIO_ACCOUNT_SID/);
  assert.match(provider,/TWILIO_API_KEY/);
  assert.match(provider,/TWILIO_API_SECRET/);
  assert.match(provider,/\/2010-04-01\/Accounts/);
  assert.match(provider,/Authorization:basic\(parent\.apiKey,parent\.apiSecret\)/);
});

test("Twilio parent health endpoint is admin-only and never returns credentials",()=>{
  const route=read("app/api/admin/integrations/twilio/health/route.ts");
  assert.match(route,/getAdminSession/);
  assert.match(route,/getTwilioParentAccount/);
  assert.match(route,/connected:true/);
  assert.doesNotMatch(route,/authToken|TWILIO_AUTH_TOKEN|TWILIO_API_SECRET/);
});

test("Twilio parent health endpoint exposes only non-secret account metadata",()=>{
  const route=read("app/api/admin/integrations/twilio/health/route.ts");
  assert.match(route,/sid:account\.sid/);
  assert.match(route,/friendlyName:account\.friendlyName/);
  assert.match(route,/status:account\.status/);
  assert.match(route,/type:account\.type/);
});
