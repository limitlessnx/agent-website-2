/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./helpers/load-typescript.cjs");
const crypto = require("node:crypto");
const user = {
  id: "admin-user",
  email: "admin@example.test",
  email_confirmed_at: "2026-11-01T00:00:00Z",
};
function fixture(options = {}) {
  const calls = {
    queries: [],
    sessions: [],
    clientClears: 0,
    legacyClears: 0,
    provisions: 0,
    lifecycle: 0,
    membershipReads: 0,
  };
  let currentUser = options.user === undefined ? user : options.user;
  let active = options.active !== false;
  const jar = new Map();
  const client = {
    auth: {
      getUser: async () => ({ data: { user: currentUser }, error: null }),
      setSession: async (values) => {
        calls.sessions.push(values);
        return {
          data: { user: currentUser },
          error: options.setSessionError
            ? { message: "private provider diagnostic" }
            : null,
        };
      },
      signOut: async () => {
        currentUser = null;
        return { error: null };
      },
    },
  };
  const access = load("lib/platform-admin-access.ts", {
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/supabase-server-rest": {
      supabaseServerRequest: async (path) => {
        calls.queries.push(path);
        if (options.registryError) throw Error("private database diagnostic");
        return active ? [{ user_id: currentUser?.id, status: "active" }] : [];
      },
    },
  });
  const auth = load(
    "lib/admin-auth.ts",
    {
      "next/headers": {
        cookies: async () => ({
          get: (key) => (jar.has(key) ? { value: jar.get(key) } : undefined),
          set: (key, value) => jar.set(key, value),
          delete: (key) => jar.delete(key),
        }),
      },
      "@/lib/supabase/server": { createClient: async () => client },
      "@/lib/platform-admin-access": access,
    },
    "",
    {
      process: {
        env: {
          NODE_ENV: "production",
          ...(options.noSecret
            ? {}
            : { ADMIN_SESSION_SECRET: "synthetic-admin-secret" }),
        },
      },
    },
  );
  const NextResponse = {
    json: (body, { status = 200 } = {}) => ({ body, status }),
    redirect: (url) => ({ status: 307, location: String(url) }),
  };
  const navigation = load("lib/auth-navigation.ts", {}, "", { URL });
  const clientAuth = {
    signInClient: async () => {
      if (options.wrongPassword) throw Error("Invalid login credentials.");
      return {
        user: currentUser,
        access_token: "synthetic-access",
        refresh_token: "synthetic-refresh",
      };
    },
    getPendingClientSetupSession: async () => null,
    getPrimaryMembership: async () => {
      calls.membershipReads++;
      return options.membership || null;
    },
    getMembershipForOrganization: async () => options.membership || null,
    setClientSession: async (session) => {
      calls.tenantSession = session;
    },
    setPendingClientSetupSession: async (session) => {
      calls.pending = session;
    },
    clearPendingClientSetupSession: async () => undefined,
    clearClientSession: async () => {
      calls.clientClears++;
    },
    clientAccountExists: async () => true,
  };
  const login = load("app/api/client-auth/login/route.ts", {
    "next/server": { NextResponse },
    "@/lib/admin-auth": {
      clearAdminSession: async () => {
        calls.legacyClears++;
      },
    },
    "@/lib/platform-admin-access": access,
    "@/lib/auth-navigation": navigation,
    "@/lib/client-onboarding": {
      provisionClientOrganization: async () => {
        calls.provisions++;
      },
    },
    "@/lib/client-auth": clientAuth,
    "@/lib/organization-membership": {
      acceptOrganizationInvitation: async () => ({
        organization_id: "tenant-b",
      }),
    },
    "@/lib/resend-events": {
      fluxknightPortalUrl: () => "/portal",
      sendFluxknightLifecycleEvent: async () => {
        calls.lifecycle++;
      },
    },
  });
  return {
    calls,
    access,
    auth,
    jar,
    login,
    navigation,
    setActive: (value) => {
      active = value;
    },
    setUser: (value) => {
      currentUser = value;
    },
  };
}
const request = (body) => ({ json: async () => body });
test("usual account login sends an approved, verified admin to dashboard without tenant provisioning or communications", async () => {
  const f = fixture();
  const result = await f.login.POST(
    request({
      email: user.email,
      password: "test-password",
      post_signup_path: "/portal",
      role: "owner",
    }),
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.redirect_to, "/dashboard");
  assert.equal(f.calls.provisions, 0);
  assert.equal(f.calls.lifecycle, 0);
  assert.equal(f.calls.membershipReads, 0);
  assert.equal(f.calls.sessions.length, 1);
  assert.equal(f.calls.clientClears, 1);
  assert.equal(f.calls.legacyClears, 1);
  assert.ok(!JSON.stringify(result).includes("synthetic-access"));
});
test("tenant owners cannot promote themselves with request/profile metadata or a dashboard redirect", async () => {
  const f = fixture({
    active: false,
    user: { ...user, user_metadata: { role: "super_admin", is_admin: true } },
  });
  const result = await f.login.POST(
    request({
      email: user.email,
      password: "test-password",
      post_signup_path: "/dashboard/clients",
      is_admin: true,
    }),
  );
  assert.equal(result.status, 403);
  assert.equal(f.calls.provisions, 0);
  assert.equal(f.calls.lifecycle, 0);
  assert.equal(f.calls.membershipReads, 0);
});
test("normal tenant login retains membership and lifecycle behavior", async () => {
  const f = fixture({
    active: false,
    membership: {
      organizationId: "tenant-b",
      organizationSlug: "tenant-b",
      membershipId: "member-b",
      role: "owner",
    },
  });
  const result = await f.login.POST(
    request({
      email: user.email,
      password: "test-password",
      post_signup_path: "/portal",
    }),
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.redirect_to, undefined);
  assert.equal(f.calls.tenantSession.organizationId, "tenant-b");
  assert.equal(f.calls.lifecycle, 1);
});
test("explicit tenant invitations still precede administrator default routing", async () => {
  const f = fixture({
    membership: {
      organizationId: "tenant-b",
      organizationSlug: "tenant-b",
      membershipId: "member-b",
      role: "owner",
    },
  });
  const result = await f.login.POST(
    request({
      email: user.email,
      password: "test-password",
      invitation_token: "signed-invitation",
      post_signup_path: "/portal",
    }),
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.redirect_to, undefined);
  assert.equal(f.calls.tenantSession.organizationId, "tenant-b");
});
test("admin sessions revalidate live provider identity and registry, and revoke access when disabled", async () => {
  const f = fixture();
  const session = await f.auth.getAdminSession();
  assert.equal(session.userId, user.id);
  assert.equal(session.authMode, "account");
  assert.match(f.calls.queries[0], /user_id=eq.admin-user&status=eq.active/);
  f.setActive(false);
  assert.equal(await f.auth.getAdminSession(), null);
  f.setActive(true);
  f.setUser(null);
  assert.equal(await f.auth.getAdminSession(), null);
});
test("unverified email and registry failure cannot create account-admin sessions", async () => {
  assert.equal(
    await fixture({
      user: { ...user, email_confirmed_at: null },
    }).auth.getAdminSession(),
    null,
  );
  const f = fixture({ registryError: true });
  assert.equal(await f.auth.getAdminSession(), null);
  const result = await f.login.POST(
    request({ email: user.email, password: "test-password" }),
  );
  assert.equal(result.status, 401);
  assert.match(result.body.error, /Unable to sign in|could not be verified/);
  assert.ok(!JSON.stringify(result).includes("private database"));
});
test("legacy recovery sessions remain compatible but production cannot use the development signing secret", async () => {
  const f = fixture();
  const session = { email: user.email, name: "Admin", issuedAt: Date.now() };
  const token = f.auth.createSessionToken(session);
  f.jar.set("limitless_admin_session", token);
  assert.equal((await f.auth.getAdminSession()).email, user.email);
  assert.equal(f.auth.verifySessionToken(token + ".suffix"), null);
  const unsecured = fixture({ noSecret: true, active: false });
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const forged =
    payload +
    "." +
    crypto
      .createHmac("sha256", "development-only-change-this-secret")
      .update(payload)
      .digest("base64url");
  assert.equal(unsecured.auth.verifySessionToken(forged), null);
});
test("provider-session mismatch fails closed and clears the newly established session", async () => {
  const f = fixture({ setSessionError: true });
  await assert.rejects(
    f.access.establishAccountSession({
      user,
      access_token: "synthetic-access",
      refresh_token: "synthetic-refresh",
    }),
    /Unable to establish/,
  );
  assert.equal(await f.auth.getAdminSession(), null);
});
test("navigation rejects external, protocol-relative, backslash and control-character redirects", () => {
  const { navigation: n } = fixture();
  for (const input of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/dashboard\n",
  ])
    assert.equal(n.safeAuthPath(input), "/portal");
  assert.equal(
    n.adminAuthDestination("/dashboard/clients?state=setup"),
    "/dashboard/clients?state=setup",
  );
  assert.equal(n.adminAuthDestination("/portal"), "/dashboard");
  assert.equal(n.isAdminPath("/dashboard-other"), false);
});

test("Google callback recognizes verified platform admins before tenant membership or setup", async () => {
  for (const active of [true, false]) {
    let membershipReads = 0;
    const f = fixture({ active });
    const route = load(
      "app/auth/callback/route.ts",
      {
        "next/server": {
          NextResponse: {
            redirect: (url) => ({ status: 307, location: String(url) }),
          },
        },
        "@/lib/supabase/server": {
          createClient: async () => ({
            auth: {
              exchangeCodeForSession: async () => ({
                data: { user },
                error: null,
              }),
              signOut: async () => undefined,
            },
          }),
        },
        "@/lib/platform-admin-access": f.access,
        "@/lib/auth-navigation": f.navigation,
        "@/lib/admin-auth": { clearAdminSession: async () => undefined },
        "@/lib/client-auth": {
          clearClientOAuthContext: async () => undefined,
          clearClientSession: async () => undefined,
          clearPendingClientSetupSession: async () => undefined,
          getClientOAuthContext: async () => ({
            nextPath: "/dashboard/clients",
          }),
          getPrimaryMembership: async () => {
            membershipReads++;
            return null;
          },
        },
        "@/lib/organization-membership": {},
      },
      "",
      { URL },
    );
    const result = await route.GET({
      url: "https://fluxknight.local/auth/callback?code=synthetic-code",
    });
    assert.equal(membershipReads, 0);
    assert.equal(
      new URL(result.location).pathname,
      active ? "/dashboard/clients" : "/account/login",
    );
    if (!active) assert.match(result.location, /admin_access_denied/);
  }
});
test("sign-out clears provider cookie chunks even during a provider outage without deleting unrelated cookies", async () => {
  const jar = new Map([
    ["sb-demo-auth-token", "private-session"],
    ["sb-demo-auth-token.0", "private-chunk"],
    ["sb-demo-auth-token.1", "private-chunk-2"],
    ["unrelated-preference", "theme"],
  ]);
  const server = load("lib/supabase/server.ts", {
    "@supabase/ssr": {
      createServerClient: () => ({
        auth: {
          signOut: async () => {
            throw Error("provider unavailable");
          },
        },
      }),
    },
    "next/headers": {
      cookies: async () => ({
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        delete: (name) => jar.delete(name),
      }),
    },
    "./config": { resolveSupabaseUrl: () => "http://127.0.0.1:4401" },
  });
  await assert.rejects(server.signOutAccount(), /provider unavailable/);
  assert.equal(jar.size, 1);
  assert.equal(jar.get("unrelated-preference"), "theme");
});

test("operator enrollment requires one existing verified account, is idempotent and cannot reactivate disabled access", async () => {
  const { PGlite } = require("@electric-sql/pglite");
  const fs = require("node:fs");
  const db = new PGlite();
  try {
    await db.exec(
      `create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table platform_super_admins(user_id uuid primary key,status text);insert into auth.users values('10000000-0000-4000-8000-000000000001','owner@example.test',now()),('10000000-0000-4000-8000-000000000002','unverified@example.test',null);`,
    );
    const sql = fs.readFileSync(
      "docs/admin-account-login/enroll-verified-admin.sql",
      "utf8",
    );
    await assert.rejects(db.exec(sql), /explicitly approved/);
    await db.query(
      "select set_config('fluxknight.admin_enrollment_email',$1,false)",
      ["unverified@example.test"],
    );
    await assert.rejects(db.exec(sql), /no rows/);
    await db.query(
      "select set_config('fluxknight.admin_enrollment_email',$1,false)",
      ["OWNER@example.test"],
    );
    await db.exec(sql);
    await db.exec(sql);
    assert.equal(
      (await db.query("select * from platform_super_admins")).rows.length,
      1,
    );
    await db.exec("update platform_super_admins set status='disabled'");
    await assert.rejects(db.exec(sql), /separate review/);
    assert.equal(
      (await db.query("select status from platform_super_admins")).rows[0]
        .status,
      "disabled",
    );
  } finally {
    await db.close();
  }
});
