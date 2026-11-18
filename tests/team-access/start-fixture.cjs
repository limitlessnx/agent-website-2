/* eslint-disable @typescript-eslint/no-require-imports */
/* Synthetic local-only server. No production keys or provider credentials are inherited. */
const http = require("node:http");
const { spawn } = require("node:child_process");
const { fixture } = require("../responsive/fixture-data.cjs");
const fixturePort = 4601;
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const readRpc =
    request.method === "POST" &&
    [
      "organization_effective_seat_limit",
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
  const table = url.pathname.split("/").pop();
  if (table === "organization_effective_seat_limit") result = 4;
  if (table === "organization_memberships") {
    const manager = url.searchParams.get("user_id") === "eq.qa-manager";
    result = result.map(row => ({...row,user_id: manager ? "qa-manager" : "qa-owner",membership_roles: row.membership_roles.map(item=>({roles:{...item.roles,slug:manager?"manager":"owner"}}))}));
  }
  if (table === "organizations") result = result.map(row=>({...row,manager_access_code:"FLX-TEST1234"}));
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
      "4600",
      "--hostname",
      "127.0.0.1",
    ],
    { env, stdio: "inherit", cwd: process.env.TEAM_TEST_APP_ROOT || process.cwd() },
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
