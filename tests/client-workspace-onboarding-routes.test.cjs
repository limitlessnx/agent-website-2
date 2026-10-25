const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');

const nextServer = {
  NextResponse: {
    json(body, init = {}) { return { body, status: init.status || 200 }; },
  },
};

function setupRoute(overrides = {}) {
  const calls = { provision: [], sessions: [], pendingWrites: [] };
  const auth = {
    getPendingClientSetupSession: async () => ({ userId: 'verified-user-id', email: 'owner@example.test', ...overrides.pending }),
    getPrimaryMembership: async () => ({
      organizationId: 'org-id', organizationSlug: 'haven-homes', membershipId: 'membership-id', role: 'owner',
      ...overrides.membership,
    }),
    setClientSession: async value => calls.sessions.push(value),
  };
  const route = load('app/api/client-auth/setup-workspace/route.ts', {
    'next/server': nextServer,
    '@/lib/client-onboarding': { provisionClientWorkspace: async input => calls.provision.push(input) },
    '@/lib/client-auth': { ...auth, ...overrides.auth },
  }, '', { URL });
  return { POST: route.POST, calls };
}

function signupRoute(overrides = {}) {
  const calls = { pendingWrites: [], sessions: [] };
  const route = load('app/api/client-auth/signup/route.ts', {
    'next/server': nextServer,
    '@/lib/client-auth': {
      signUpClient: async (...args) => { calls.signupArgs = args; return overrides.auth || { user: { id: 'auth-user-id', email: 'owner@example.test' } }; },
      setPendingClientSetupSession: async value => calls.pendingWrites.push(value),
      getMembershipForOrganization: async () => overrides.membership || null,
      setClientSession: async value => calls.sessions.push(value),
    },
    '@/lib/organization-membership': {
      acceptOrganizationInvitation: async () => ({ organization_id: 'invited-org-id' }),
    },
    '@/lib/resend-events': {
      fluxknightPortalUrl: () => 'https://portal.example.test',
      sendFluxknightLifecycleEvent: async () => undefined,
    },
  });
  return { POST: route.POST, calls };
}

function loginRoute(overrides = {}) {
  const calls = { provision: [], pendingWrites: [], sessions: [], lifecycle: [] };
  const route = load('app/api/client-auth/login/route.ts', {
    'next/server': nextServer,
    '@/lib/client-onboarding': { provisionClientOrganization: async input => calls.provision.push(input) },
    '@/lib/client-auth': {
      signInClient: async () => overrides.auth || { user: { id: 'auth-user-id', email: 'owner@example.test', user_metadata: {} } },
      getPendingClientSetupSession: async () => overrides.pending || null,
      getPrimaryMembership: async () => overrides.membership || null,
      getMembershipForOrganization: async () => overrides.membership || null,
      setPendingClientSetupSession: async value => calls.pendingWrites.push(value),
      setClientSession: async value => calls.sessions.push(value),
      clientAccountExists: async () => true,
    },
    '@/lib/organization-membership': {
      acceptOrganizationInvitation: async () => {
        if (overrides.invitationError) throw new Error(overrides.invitationError);
        return { organization_id: 'invited-org-id' };
      },
    },
    '@/lib/resend-events': {
      fluxknightPortalUrl: () => 'https://portal.example.test',
      sendFluxknightLifecycleEvent: async value => calls.lifecycle.push(value),
    },
  });
  return { POST: route.POST, calls };
}

const request = body => ({ json: async () => body });

test('workspace setup uses the signed pending user, forwards the selected industry and continues into the wizard', async () => {
  const route = setupRoute({ pending: { txRef: 'payment-ref' } });
  const response = await route.POST(request({
    user_id: 'attacker-controlled-id',
    company_name: 'Haven Homes',
    industry_slug: 'real-estate',
  }));
  assert.equal(response.status, 200);
  assert.equal(route.calls.provision.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(route.calls.provision[0])), {
    userId: 'verified-user-id',
    organizationName: 'Haven Homes',
    organizationSlug: 'haven-homes',
    industrySlug: 'real-estate',
    businessEmail: 'owner@example.test',
  });
  assert.equal(route.calls.sessions[0].userId, 'verified-user-id');
  assert.equal(response.body.redirect_to, '/onboarding?tx_ref=payment-ref');
});

test('workspace setup does not convert a failed invitation into an owner workspace', async () => {
  const route = setupRoute({ pending: { invitationToken: 'invite-token' } });
  const response = await route.POST(request({ company_name: 'Haven Homes', industry_slug: 'real-estate' }));
  assert.equal(response.status, 409);
  assert.equal(route.calls.provision.length, 0);
  assert.equal(route.calls.sessions.length, 0);
});

test('workspace setup rejects malformed industry values before provisioning', async () => {
  const route = setupRoute();
  const response = await route.POST(request({ company_name: 'Haven Homes', industry_slug: '../xposure' }));
  assert.equal(response.status, 400);
  assert.equal(route.calls.provision.length, 0);
});

test('new signup persists onboarding and payment context across email verification', async () => {
  const route = signupRoute();
  const response = await route.POST(request({
    full_name: 'Newton Example',
    email: 'owner@example.test',
    password: 'safe-password',
    password_confirmation: 'safe-password',
    payment_tx_ref: 'paid-checkout-ref',
    post_signup_path: '/portal',
  }));
  assert.equal(response.status, 201);
  assert.equal(response.body.requires_email_confirmation, true);
  assert.equal(route.calls.pendingWrites[0].userId, 'auth-user-id');
  assert.equal(route.calls.pendingWrites[0].nextPath, '/onboarding');
  assert.equal(route.calls.pendingWrites[0].txRef, 'paid-checkout-ref');
});

test('login after email verification restores a pending owner workspace instead of losing checkout context', async () => {
  const route = loginRoute({ pending: { userId: 'auth-user-id', email: 'owner@example.test', nextPath: '/portal', txRef: 'old-ref' } });
  const response = await route.POST(request({ email: 'owner@example.test', password: 'safe-password', payment_tx_ref: 'current-ref' }));
  assert.equal(response.status, 200);
  assert.equal(response.body.requires_workspace_setup, true);
  assert.equal(response.body.redirect_to, '/account/setup');
  assert.equal(route.calls.pendingWrites[0].userId, 'auth-user-id');
  assert.equal(route.calls.pendingWrites[0].nextPath, '/onboarding');
  assert.equal(route.calls.pendingWrites[0].txRef, 'current-ref');
  assert.equal(route.calls.provision.length, 0);
});

test('failed invitation login never invokes owner workspace provisioning', async () => {
  const route = loginRoute({
    pending: { userId: 'auth-user-id', email: 'owner@example.test', invitationToken: 'expired-invite' },
    invitationError: 'Invitation expired',
  });
  const response = await route.POST(request({ email: 'owner@example.test', password: 'safe-password' }));
  assert.notEqual(response.status, 200);
  assert.equal(route.calls.provision.length, 0);
  assert.equal(route.calls.sessions.length, 0);
});
