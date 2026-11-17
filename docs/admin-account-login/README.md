# Existing-account super-admin login

## Finding and scope

The old `/login` checked a separate environment password and issued a signed admin cookie. Normal Fluxknight account credentials therefore did not grant access. The existing `platform_super_admins` registry was not consulted by app authentication. This change is based on main and is independent of onboarding PR #406 and design-system PR #408.

`/login` now opens the existing account sign-in form. Password and Google sign-in use Supabase Auth; a verified provider user ID must have an active registry entry for platform access. Tenant ownership and editable profile metadata never grant this role. Account-based authorization checks the provider and registry on each admin request. Explicit invitations retain their existing flow. Tenant memberships, onboarding and lifecycle behavior remain in place.

Legacy operator credentials remain available at `/login?legacy=1` for recovery. Disabling a registry entry revokes account-based admin access, not legacy credentials. The public development signing fallback is disabled in production, and malformed legacy tokens are rejected. Logout clears provider cookie chunks even when remote sign-out fails.

## Files and responsibilities

- `lib/platform-admin-access.ts`, `lib/auth-navigation.ts`: registry verification, provider session establishment and internal redirect validation.
- `lib/admin-auth.ts`, `lib/supabase/server.ts`: shared authorization and reliable session removal.
- Account login, legacy login, password field and authentication API/callback routes: normal-account routing, accessible password naming, Google parity, safe errors and logout.
- `lib/client-auth.ts`: verified-email typing and removal of an unused variable.
- Authentication tests and fixture: real Next/browser integration against isolated synthetic Auth/REST endpoints; no production credentials, communications or provisioning services.
- Package scripts/lockfile and ignore rules: reproducible Playwright checks and ignored transient artifacts.
- `enroll-verified-admin.sql`: reviewable operator enrollment, not a migration or an automatically executed app operation.

## Verification

- Focused authentication suite: 4/4 test files passed, including runtime cases for role revocation, forged metadata, unverified email, registry outage, provider identity mismatch, invitation precedence and idempotent enrollment.
- Support regression suite: 65/65 files passed.
- Focused ESLint and TypeScript passed. Production build passed.
- Real Chromium/Next flow passed at 360, 430, 768, 1024, 1440 and 1920px: normal account login, wrong-password rejection, tenant denial, registry revocation, and logout during provider outage. No page errors or horizontal overflow.
- See `browser-results.json` and six synthetic screenshots. These are evidence, not approved visual baselines. No pre-change screenshot was captured for this isolated fix. The 360px screenshot was visually inspected.
- Browser tests are synthetic local integration tests. They do not establish that a nominated production account can log in before deployment and enrollment. This branch does not include Phase 2 UI changes.

Commands: `npm run test:admin-auth`, `npm run test:support`, `npm run test:admin-auth-browser`, `npx tsc --noEmit`, focused `npx eslint`, `npm run build`.

## Approval-gated rollout

Read-only production checks found the nominated account already exists, has a verified email and a password, and has no admin registry entry. The registry had no active admins. No password or credential material was retrieved. No enrollment, account reset, environment change, migration, main merge or production deployment has been performed by this fix.

1. Obtain explicit approval for both enrollment and production release of this PR.
2. In one operator transaction, set the transaction-local `fluxknight.admin_enrollment_email` to the approved email, execute `enroll-verified-admin.sql`, verify exactly that verified user has an active entry, then commit. The script refuses missing/unverified accounts and disabled entries; replay is idempotent. Do not run outside the explicit approval.
3. Promote only the reviewed login change after checks pass. Enroll before promotion so the approved administrator does not enter tenant setup during release.
4. Have the account owner sign in using the usual account password or already-linked Google identity. Do not request their password. Check admin routing and sign-out. Roll back the app release if required; role revocation is a separately reviewed operator action.
5. Integrate this fix into the onboarding/design branches and test their previews with the outbound-disabled QA tenant before proceeding to later phases.

Remaining gate: authenticated production acceptance requires the approved deployment and enrollment. Existing unrelated source-contract tests outside the selected suites are not claimed green.
