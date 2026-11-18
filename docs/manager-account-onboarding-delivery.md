# Manager account creation and organization joining

Base: released main `ba6f79ca8dc9b9f6d3d3cbcb58c10f5e1a811414`. Isolated branch: `feat/manager-account-onboarding`.

## Result

Create an account with email or Google, verify the identity, then choose **Organization owner** or **Manager** on the existing account-choice page. An owner continues to the existing business setup. A manager opens the existing manager-access page, enters the owner's Organization Access ID (`FLX-XXXXXXXX`) and submits a pending request. The owner finds the ID and approves/rejects requests in **Team** settings. Entering a code alone grants no membership or tenant session. Approved active workspaces appear in the manager hub, and entry checks live membership and organization status again.

Selecting Manager is an account preference, not a platform role or tenant permission grant. Owners retain invitations, approvals, billing, trial activation and member lifecycle control. Existing seat limits and atomic owner approval remain authoritative.

## Audit findings

- Google callback already had account-mode selection, manager mode and a protected join flow. Email signup/login bypassed the choice and directed users toward owner setup. Email login ignored saved manager mode.
- The manager page listed access requests but omitted active memberships, so invitation-based access and returning managers were poorly represented.
- Setup context could be issued before email confirmation. Account-mode selection previously trusted that context without always validating a live verified identity.
- Logout omitted the manager cookie. Signing into a different account or via Google could leave stale manager context.
- Google start changed a www callback to the apex after writing a host-only context cookie. It now redirects to the canonical start first; preview hosts are preserved.
- The manager route inherited public marketing navigation/footer and the public assistant overlay. It now uses the existing application-area shell boundary and existing sign-out button.
- Existing Google source-contract checks had four baseline failures, reproduced before edits: stale copy/format expectations and over-escaped router expressions. These were corrected alongside actual runtime coverage; the canonical-host behavior also received a functional regression test.
- Older PR #238 overlaps the login route but remains open and untouched. Legacy PRs were not merged or overwritten.

Read-only production metadata confirms `client_account_profiles`, `organization_access_requests`, the organization access-code column and the owner approval RPC exist. **No database migration is introduced or applied.**

## Files changed and reasons

| Area | Changes |
| --- | --- |
| `app/api/client-auth/signup/route.ts`, `app/account/signup/SignupForm.tsx` | Uninvited email signup preserves payment/verification context and reaches the shared account choice. Immediate authenticated signup establishes the existing provider session. Invitation signup retains its separate, authoritative acceptance path. |
| `app/api/client-auth/login/route.ts`, `app/auth/callback/route.ts` | Honor saved manager mode, clear stale manager context and return managers to the access hub. Keep Super Admin routing, explicit invitations and legacy owner setup behavior. |
| `app/api/client-auth/account-mode/route.ts`, `app/api/client-auth/setup-workspace/route.ts` | Require a live verified identity; ignore foreign pending context and forged actor fields. Prevent invitation context or manager mode from being converted into owner workspace creation. Preserve owner checkout context. |
| `app/api/client-auth/logout/route.ts` | Clear manager sessions alongside existing account/application cookies. |
| `app/api/client-auth/google/start/route.ts` | Canonicalize www before writing OAuth context; keep invitation parameters and preview origins. |
| `app/api/client-auth/manager-access/route.ts`, `lib/client-auth.ts` | Return active authorized workspaces, scope requests to the signed identity and recheck active organization/membership on entry. Preserve the existing request/approval service and avoid leaking raw database errors. |
| `app/manage-organizations/ManagerOrganizationsClient.tsx` | Existing manager hub gains active workspaces, keyboard-submit code form, explicit pending/approval guidance, refresh, retry/error states, aborted-load cleanup and existing sign-out control. |
| `app/account/choose-mode/AccountModeClient.tsx`, its CSS module | Explicit owner/manager labels, invitation/code guidance and sign-in recovery. Reuse existing purple cards for workspace entries; contain long names/emails and wrap request rows. |
| `components/SiteShell.tsx` | Classify the exact manager-access route as an application area, avoiding competing marketing navigation and the public assistant overlay. |
| Existing auth/source-contract tests | Keep verified invitations, owner setup, Super Admin routing and active-tenant access checks aligned with the real behavior. |
| `tests/manager-account-onboarding.test.cjs` | Eighteen actual route/runtime scenarios, with synthetic provider/database boundaries, covering mode selection, identity verification, sign-in continuity, requests, membership checks and logout. |
| `tests/manager-onboarding/*`, `playwright.manager-onboarding.config.ts` | Rendered signup/choice/owner/manager flow at six widths with local synthetic sessions and intercepted onboarding responses; long content, pending/approved states, revoked entry and loading recovery. Fixture refuses backend writes and inherits no provider keys. |
| `package.json`, `.github/workflows/team-access.yml` | Register focused runtime/UI commands in the existing team-access verification workflow and upload synthetic screenshot evidence. |

## Design and responsiveness

12ui reviewed the public existing account-choice screenshot, generated two references, selected A and completed conversion/plan. Post-implementation alignment against the unchanged selected LayerDoc also completed. Kits: `/tmp/flux-manager-account-design-image` and `/tmp/flux-manager-account-alignment-final`.

The selected direction retains the purple palette and two explicit cards. The kit produced an unanchored target rather than a matched source diff. Its new decorative planetary raster background and raster icons were deliberately not shipped: the user's guardrails require preserving established branding/components and incremental changes, and this task changes account access rather than rebuilding the auth design. Existing vector icons, card geometry and background remain authoritative. No new global tokens or animation library were needed. No screenshot is labeled an approved visual baseline.

Before: `/tmp/flux-manager-visual-before/choose-mode-430.png` (public deployed screen). After: `test-results/manager-onboarding/`, including account choice and manager empty/pending/approved/error states. The CI artifact `manager-onboarding-responsive` contains synthetic screenshots and JSON results. Widths: 360, 430, 768, 1024, 1440 and 1920px. Tests assert no document horizontal overflow at each captured state. Status/error feedback uses live regions; native buttons/forms preserve keyboard use; reduced motion is exercised by the recovery case.

## Validation and limits

Current local/hosted results and PR/preview links are recorded in the PR description and final release-review report after the last checks finish. Local build/type verification is recorded for the final candidate in the PR. Focused runtime checks and the Maia/support suites passed after strengthening the active-organization guardrail contracts. The original browser run exposed ambiguous test selectors for password visibility controls and Next.js route announcements; corrected selectors subsequently passed all 24 cases. The final run including the application-shell correction passed 24/24 cases, with zero skipped/flaky cases and 54 captured states across the six widths.

Tests use synthetic identities, mock authentication/database boundaries or the existing local database fixtures. Browser signup and approval responses are intercepted; this is **not** a claim that real email verification, Google consent or authenticated hosted manager acceptance ran. No actual signup, email, campaign, invitation delivery, provider call, trial or billing action is used during tests. Whole-repository historical lint debt is separate from changed-file lint.

The existing account-mode preference is not an administrator role. Tenant approval is still required. Mode switching after an existing saved choice remains constrained by the established account-mode endpoint; this change does not migrate existing owners into managers.

## Production status

This feature is implemented in isolation for PR and preview review. Production remains on the earlier approved Phase 6 release. No production customer data, permissions, provider configuration or database schema was modified by this work. Merging and production deployment require explicit approval for this new feature.

Hosted first-candidate verification found the Hotel manager-access fixture omitted the newly reused active-workspace helper. The fixture now models approval/removal consistently and all eleven Hotel setup test files pass locally. This correction changes no application behavior. Protected preview HTTP checks returned 200 for signup/choice; the signup HTML includes the new guidance. Independent Chromium reached Vercel Login. A public share-link request was denied, so protection settings were left unchanged and authenticated rendered preview acceptance is not claimed.
