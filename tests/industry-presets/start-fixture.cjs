/* eslint-disable @typescript-eslint/no-require-imports */
/* Synthetic local-only server. No production keys or provider credentials are inherited. */
const http = require("node:http");
const { spawn } = require("node:child_process");
const { fixture } = require("../responsive/fixture-data.cjs");
const fixturePort = 4801;
const industries = ["general","sales-companies","professional-services","service-businesses","auto-shops","beauty-salons","clinics","gyms","ecommerce","restaurants"];
const permissions = ["organization.view","agents.view","customers.view","customers.manage","conversations.view","systems.view","appointments.view","analytics.view","members.view","billing.view","integrations.view","support.escalate"];
const users = new Map();
const progressProfiles = new Map();

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const table = url.pathname.split("/").pop();
  const scope = (url.searchParams.get("organization_id") || url.searchParams.get("organization_uuid") || url.searchParams.get("id") || "").replace(/^eq\./,"");
  const orgId = /^10000000-0000-4000-8000-0000000000(?:0[1-9]|10)$/.test(scope) ? scope : "10000000-0000-4000-8000-000000000001";
  const index = Math.max(0,Math.min(9,Number(orgId.slice(-2))-1));
  const user = url.searchParams.get("user_id")?.replace(/^eq\./,"") || users.get(orgId) || "qa-owner";
  if (url.searchParams.has("user_id")) users.set(orgId,user);
  const mode = user.replace(/^qa-/,"");
  if ((mode === "outage" && table === "workflow_runs") || (mode === "system-outage" && table === "organization_systems")) {
    response.writeHead(503,{"Content-Type":"application/json"});return response.end(JSON.stringify({message:"Synthetic unavailable evidence. Never show this provider-secret marker."}));
  }
  if (url.pathname === "/rest/v1/rpc/ensure_flux_credit_wallet") {
    response.writeHead(200,{"Content-Type":"application/json"});return response.end(JSON.stringify({id:"qa-wallet",organization_id:orgId,plan_code:"basic",monthly_allowance:1000,balance:1000,bonus_balance:0,top_up_balance:0,status:"active",current_period_start:"2026-11-01T00:00:00Z",trial_ends_at:null,trial_credit_limit:null}));
  }
  const readRpc =
    request.method === "POST" &&
    [
      "hotel_tenant_inventory_readiness",
      "hotel_overview_core",
      "hotel_dashboard_trends",
    ].some((name) => url.pathname === `/rest/v1/rpc/${name}`);
  // Only the isolated onboarding browser fixture can update its own profile.
  if (request.method === "PATCH" && table === "client_onboarding_profiles" && mode.startsWith("progress-") && url.searchParams.get("organization_id") === "eq."+orgId && url.searchParams.get("user_id") === "eq."+user) {
    const current = progressProfiles.get(user);
    if (!current) { response.writeHead(404,{"Content-Type":"application/json"}); return response.end(JSON.stringify({message:"No synthetic onboarding profile"})); }
    if(url.searchParams.has("updated_at") && url.searchParams.get("updated_at") !== "eq."+current.updated_at){response.writeHead(200,{"Content-Type":"application/json"});return response.end("[]");}
    let body=""; request.on("data",chunk=>{body+=chunk;}); request.on("end",()=>{
      try {
        const input=JSON.parse(body);
        const allowed=new Set(["current_step","business_name","business_description","website","country","timezone","business_email","phone","staff_size","ai_requirements","business_knowledge","whatsapp_preferences","requested_agents","business_goals","channels","existing_tools","human_contact_name","human_contact_email","notes","updated_at","status","completed_at"]);
        if(Object.keys(input).some(key=>!allowed.has(key)))throw Error("Synthetic profile patch not permitted");
        Object.assign(current,input,{updated_at:new Date().toISOString()});
        response.writeHead(200,{"Content-Type":"application/json"});response.end(JSON.stringify([current]));
      } catch(error){response.writeHead(400,{"Content-Type":"application/json"});response.end(JSON.stringify({message:error.message}));}
    });return;
  }
  if (request.method !== "GET" && !readRpc) {
    response.writeHead(405, { "Content-Type": "application/json" });
    return response.end(
      JSON.stringify({
        message: "Fixture disallows writes and external automation.",
      }),
    );
  }
  let result = fixture(url);
  if (table === "organizations") result = [{id:orgId,slug:`qa-${industries[index]}`,name:"Synthetic organization",status:"active",metadata:{industry:industries[index],workspace_mode:mode.startsWith("free")?"free":"configured",qa_test:true,outbound_disabled:true}}];
  if (table === "client_onboarding_profiles") result = [{...(Array.isArray(result)?result[0]:{}),id:`profile-${orgId}`,organization_id:orgId,user_id:user,business_name:"An organization with a deliberately long business name for responsive checks",industry:mode==="unknown"?"An unlisted organization":industries[index],business_knowledge:{},status:"configuration",whatsapp_preferences:{},requested_agents:[],channels:[],existing_tools:[]}];
  if (table === "client_onboarding_profiles" && mode.startsWith("progress-")) {
    if(!progressProfiles.has(user))progressProfiles.set(user,{...result[0],status:"in_progress",current_step:1,business_description:"",business_goals:[],ai_requirements:"",business_knowledge:{faqs:"Existing saved FAQ"},whatsapp_preferences:{connection_path:"already_have_whatsapp_business",preferred_number:"synthetic-number"},channels:["WhatsApp"],existing_tools:["Existing CRM"],updated_at:"2026-11-17T08:00:00.000Z"});
    result=[progressProfiles.get(user)];
  }
  if (table === "organization_memberships") result = [{id:"qa-membership",organization_id:orgId,user_id:user,status:"active",organizations:{slug:`qa-${industries[index]}`,status:"active"},membership_roles:[{roles:{id:"qa-role",organization_id:orgId,slug:mode==="viewer"||mode==="free-manager"?"manager":"owner",role_permissions:(mode==="viewer"?["customers.view"]:permissions).map(key=>({permissions:{key}}))}}]}];
  if (table === "organization_systems" && mode === "missing") result=[];
  if (table === "organization_systems" && mode === "paused") result=[{status:"paused",system_catalog:{slug:"appointment-system"}}];
  const count = Array.isArray(result) ? result.length : 1;
  if (request.headers.accept?.includes("application/vnd.pgrst.object+json"))
    result = Array.isArray(result) ? result[0] || null : result;
  response.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Range": `0-${Math.max(0, count - 1)}/${count}`,
  });
  response.end(JSON.stringify(result));
});
server.listen(fixturePort, "127.0.0.1", () => {
  const env = Object.fromEntries(
    ["PATH", "HOME", "TMPDIR", "NODE_EXTRA_CA_CERTS"]
      .filter((key) => process.env[key])
      .map((key) => [key, process.env[key]]),
  );
  Object.assign(env, {
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    SUPABASE_URL: `http://127.0.0.1:${fixturePort}`,
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`,
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-test-key",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-test-key",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-test-key",
    ADMIN_SESSION_SECRET: "synthetic-local-test-secret",
    CLIENT_SESSION_SECRET: "synthetic-local-test-secret",
    LIMITLESS_ADMIN_EMAIL: "admin@example.test",
    LIMITLESS_ADMIN_PASSWORD: "synthetic-local-password",
  });
  const app = spawn(
    process.execPath,
    [
      "--require",
      require.resolve("../responsive/fixed-clock.cjs"),
      "node_modules/next/dist/bin/next",
      "dev",
      "--port",
      "4800",
      "--hostname",
      "127.0.0.1",
    ],
    { env, stdio: "inherit", cwd: process.env.PRESET_APP_ROOT || process.cwd() },
  );
  const stop = () => {
    app.kill("SIGTERM");
    server.close();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  app.on("exit", (code) => {
    server.close();
    process.exitCode = code || 0;
  });
});
