/* eslint-disable @typescript-eslint/no-require-imports */
/* Synthetic local-only server. No production keys or provider credentials are inherited. */
const http = require("node:http");
const { spawn } = require("node:child_process");
const { fixture } = require("../responsive/fixture-data.cjs");
const fixturePort = 4401;
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  // These RPCs are simulated locally; nothing is forwarded or persisted.
  if (url.pathname === "/rest/v1/rpc/ensure_flux_credit_wallet") {
    response.writeHead(200,{"Content-Type":"application/json"});
    return response.end(JSON.stringify({id:"qa-wallet", organization_id:"10000000-0000-4000-8000-000000000001",plan_code:"basic",monthly_allowance:1000,balance:1000,bonus_balance:0,top_up_balance:0,status:"active",current_period_start:"2026-11-01T00:00:00Z",current_period_end:null,trial_ends_at:null,trial_credit_limit:null}));
  }
  if (url.pathname === "/rest/v1/rpc/get_flux_commercial_snapshot") {
    response.writeHead(200,{"Content-Type":"application/json"});
    return response.end(JSON.stringify({organizationId:"10000000-0000-4000-8000-000000000001",subscription:null,wallet:null,servicePackage:null,usage:{usedThisMonth:0,usageEvents:0,providerCostCents:0},systems:{active:1,needsAttention:0}}));
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
  if (url.pathname === "/rest/v1/agents") result = [{id:"20000000-0000-4000-8000-000000000001",name:"Maia — Customer Experience Concierge",status:"draft",agent_type:"maia",system_prompt:null,communication_channels:[],organization_id:"10000000-0000-4000-8000-000000000001"}];
  if (Array.isArray(result)) result = result.map((row) => {
    const table = url.pathname.split("/").pop();
    if (table === "organization_systems") return {...row,id:"qa-installation",requested_at:"2026-11-01T00:00:00Z",system_catalog:{...row.system_catalog,name:"Appointment system",summary:"Organization-scoped booking configuration",capabilities:["Bookings","Availability"]}};
    if (table === "organizations") return {...row, name: row.name + " — The International Customer Experience and Business Operations Group", created_at:"2026-11-01T00:00:00Z"};
    if (table === "organization_memberships") return {...row, created_at:"2026-11-01T00:00:00Z"};
    if (table === "client_onboarding_profiles") return {...row, business_name: row.business_name + " — The International Customer Experience and Business Operations Group", business_email:"a-very-long-customer-success-and-reservations-address@example.test", human_contact_email:"customer-experience-and-operations-supervisor@example.test", human_contact_name:"Customer Experience and Business Operations Supervisor"};
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
