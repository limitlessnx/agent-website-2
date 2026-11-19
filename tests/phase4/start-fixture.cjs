/* eslint-disable @typescript-eslint/no-require-imports */
/* Synthetic local-only server. No production keys or provider credentials are inherited. */
const http = require("node:http");
const { spawn } = require("node:child_process");
const { fixture } = require("../responsive/fixture-data.cjs");
const fixturePort = 4401;
let workflowUnavailable = false;
let scenario = "normal";
const audits = [];
const orgId = "10000000-0000-4000-8000-000000000001";
const recordedAt = "2026-11-01T09:00:00.000Z";
const systemOrganizations = [
  {id:"10000000-0000-4000-8000-000000000005",name:"Fluxknight",slug:"fluxknight",status:"active"},
  {id:"10000000-0000-4000-8000-000000000006",name:"Limitless Realty",slug:"limitless-realty",status:"active"},
  {id:"10000000-0000-4000-8000-000000000007",name:"Gencouv",slug:"gencouv",status:"active"},
];
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/__qa/scenario") {
    scenario = url.searchParams.get("value") || "normal";
    response.writeHead(200,{"Content-Type":"application/json"});return response.end(JSON.stringify({scenario}));
  }
  if (url.pathname === "/__qa/audits") {
    response.writeHead(200,{"Content-Type":"application/json"});return response.end(JSON.stringify(audits));
  }
  const table = url.pathname.split("/").pop();
  if (table === "flux_credit_ledger" && scenario === "credit-history-unavailable") {
    response.writeHead(503, {"Content-Type":"application/json"});return response.end(JSON.stringify({message:"PRIVATE_PROVIDER_DIAGNOSTIC"}));
  }
  const evidenceTables = ["organization_integration_admin_view","agent_runtime_tool_runs","maia_inbound_events","automation_provisioning_jobs","transactional_email_events","elevenlabs_voice_calls","whatsapp_delivery_attempts"];
  if (scenario === "outage" && evidenceTables.includes(table)) {
    response.writeHead(503,{"Content-Type":"application/json"});return response.end(JSON.stringify({message:"PRIVATE_PROVIDER_DIAGNOSTIC"}));
  }
  // Audit insertion exists only in this in-memory fixture. Never forwarded.
  if (table === "audit_logs" && request.method === "POST") {
    if (scenario === "audit-failure") {response.writeHead(503);return response.end("{}");}
    let body="";request.on("data",chunk=>body+=chunk);request.on("end",()=>{audits.push(JSON.parse(body));response.writeHead(201,{"Content-Type":"application/json"});response.end("{}");});return;
  }
  if (url.pathname === "/__qa/workflow-unavailable") {
    workflowUnavailable = url.searchParams.get("value") === "1";
    response.writeHead(200,{"Content-Type":"application/json"}); return response.end(JSON.stringify({ok:true}));
  }
  if (workflowUnavailable && ["/rest/v1/workflow_registry","/rest/v1/workflow_runs"].includes(url.pathname)) {
    response.writeHead(503,{"Content-Type":"application/json"}); return response.end(JSON.stringify({message:"Synthetic workflow outage"}));
  }
  // These RPCs are simulated locally; nothing is forwarded or persisted.
  if (url.pathname === "/rest/v1/rpc/get_flux_credit_availability") {
    response.writeHead(scenario === "credit-unavailable" ? 503 : 200, {"Content-Type":"application/json"});
    return response.end(JSON.stringify(scenario === "credit-unavailable" ? {message:"PRIVATE_PROVIDER_DIAGNOSTIC"} : {balance:1000,reserved:scenario === "credit-held" ? 1000 : 996,available:scenario === "credit-held" ? 0 : 4}));
  }
  if (url.pathname === "/rest/v1/rpc/ensure_flux_credit_wallet") {
    response.writeHead(200,{"Content-Type":"application/json"});
    return response.end(JSON.stringify({id:"qa-wallet", organization_id:"10000000-0000-4000-8000-000000000001",plan_code:"basic",monthly_allowance:1000,balance:1000,bonus_balance:0,top_up_balance:0,status:"active",current_period_start:"2026-11-01T00:00:00Z",current_period_end:null,trial_ends_at:null,trial_credit_limit:null}));
  }
  if (url.pathname === "/rest/v1/rpc/get_flux_commercial_snapshot") {
    response.writeHead(200,{"Content-Type":"application/json"});
    return response.end(JSON.stringify({organizationId:"10000000-0000-4000-8000-000000000001",subscription:null,wallet:null,servicePackage:null,usage:{usedThisMonth:0,usageEvents:0,providerCostCents:0},systems:{active:1,needsAttention:0}}));
  }
  if (url.pathname.startsWith("/auth/v1/admin/users/")) {
    response.writeHead(200,{"Content-Type":"application/json"});
    return response.end(JSON.stringify({id:"30000000-0000-4000-8000-000000000001",email:"owner@example.test",aud:"authenticated",role:"authenticated",created_at:"2026-11-01T00:00:00Z",app_metadata:{provider:"email",providers:["email"]},user_metadata:{},identities:[]}));
  }
  const readRpc =
    request.method === "POST" &&
    [
      "hotel_tenant_inventory_readiness",
      "hotel_overview_core",
      "hotel_dashboard_trends",
    ].some((name) => url.pathname === `/rest/v1/rpc/${name}`);
  if (request.method !== "GET" && !readRpc) {
    response.writeHead(405, { "Content-Type": "application/json" });
    return response.end(
      JSON.stringify({
        message: "Fixture disallows writes and external automation.",
      }),
    );
  }
  let result = fixture(url);
  if (table === "organizations") {
    const all = [...fixture(new URL("http://fixture/rest/v1/organizations")),...systemOrganizations];
    const id = url.searchParams.get("id"); const slug = url.searchParams.get("slug");
    result = all.filter(row=>(!id || id === `eq.${row.id}`)&&(!slug || !slug.startsWith("eq.") || slug === `eq.${row.slug}`));
    if (slug?.startsWith("in.(")) result = result.filter(row=>slug.slice(4,-1).split(",").includes(row.slug));
    if (slug?.startsWith("not.in.(")) result = result.filter(row=>!slug.slice(8,-1).split(",").includes(row.slug));
    const name = url.searchParams.get("name");
    if (name?.startsWith("ilike.")) {const needle=name.slice(6).replace(/^%|%$/g,"").toLowerCase();result=result.filter(row=>row.name.toLowerCase().includes(needle));}
  }
  if (table === "organization_integration_admin_view") result = [
    {id:"connection-1",organization_id:orgId,organization_name:"Demo Business — International Customer Experience and Business Operations Group",provider:"whatsapp",display_name:"WhatsApp / Meta",status:"authentication_failed",has_credentials:true,secret_keys:[],last_checked_at:recordedAt,health:{}},
    {id:"connection-2",organization_id:orgId,organization_name:"Demo Business",provider:"google_calendar",display_name:"Google Calendar",status:"pending_authorization",has_credentials:false,secret_keys:[],last_checked_at:null,health:{}},
  ];
  if (table === "automation_provisioning_jobs") result = [{id:"job-1",organization_id:orgId,status:"failed",attempts:1,max_attempts:5,updated_at:recordedAt}];
  if (table === "agent_runtime_tool_runs") result = scenario === "pending" ? [{id:"tool-pending",organization_id:orgId,status:"pending"}] : ["completed","failed","pending"].map((status,index)=>({id:`tool-${index}`,organization_id:orgId,status,tool_name:"diagnostic",started_at:recordedAt}));
  if (table === "maia_inbound_events") result = [{id:"maia-1",organization_id:orgId,status:"failed"},{id:"maia-2",organization_id:orgId,status:"processing"}];
  if (["transactional_email_events","elevenlabs_voice_calls","whatsapp_delivery_attempts"].includes(table)) result = [{id:table+"-1",organization_id:orgId,status:"failed"}];
  if (table === "audit_logs") result = [{id:"audit-1",organization_id:orgId,actor_user_id:null,action:"admin.workspace.select",resource_type:"organization",created_at:recordedAt,metadata:{actor_email:"admin@example.test",outcome:"selected",credential:"PRIVATE_AUDIT_METADATA"}}];
  if (scenario === "empty" && evidenceTables.includes(table)) result = [];
  const organizationFilter = url.searchParams.get("organization_id");
  if (evidenceTables.includes(table) && organizationFilter) result = result.filter(row=>organizationFilter === `eq.${row.organization_id}`);
  if (url.pathname === "/rest/v1/agents") result = [{id:"20000000-0000-4000-8000-000000000001",name:"Maia — Customer Experience Concierge",status:"draft",agent_type:"maia",system_prompt:null,communication_channels:[],organization_id:"10000000-0000-4000-8000-000000000001"}];
  if (Array.isArray(result)) result = result.map((row) => {
    const table = url.pathname.split("/").pop();
    if (table === "organization_systems") return {...row,id:"qa-installation",requested_at:"2026-11-01T00:00:00Z",system_catalog:{...row.system_catalog,name:"Appointment system",summary:"Organization-scoped booking configuration",capabilities:["Bookings","Availability"]}};
    if (table === "organizations") return {...row, name: row.name + " — The International Customer Experience and Business Operations Group", created_at:"2026-11-01T00:00:00Z"};
    if (table === "organization_memberships") return {...row, user_id:"30000000-0000-4000-8000-000000000001", created_at:"2026-11-01T00:00:00Z"};
    if (table === "client_onboarding_profiles") return {...row, user_id:"30000000-0000-4000-8000-000000000001", business_name: row.business_name + " — The International Customer Experience and Business Operations Group", business_email:"a-very-long-customer-success-and-reservations-address@example.test", human_contact_email:"customer-experience-and-operations-supervisor@example.test", human_contact_name:"Customer Experience and Business Operations Supervisor"};
    return row;
  });
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
      "node_modules/next/dist/bin/next",
      "dev",
      "--port",
      "4400",
      "--hostname",
      "127.0.0.1",
    ],
    { env, stdio: "inherit" },
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
