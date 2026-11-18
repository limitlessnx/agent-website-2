# General organization workspace and industry presets

Phase: 5, incremental shared foundation for general businesses and the nine remaining offered industries.
Base commit: `ae2a41f9031544f340ae9144bc79fb0c72819b8b`.
Branch: `feat/phase5-general-industry-presets`.
Production modified: **No**.
PR and exact preview/CI commit: recorded in the pull request description.

## Delivered behavior

The existing industry experience registry now supplies version-one, data-free workspace presets. New and existing businesses resolve them from their current onboarding industry; there is no second tenant registry, database template assignment system or provisioning service.

| Offered organization type | Workspace preset |
| --- | --- |
| General or unlisted business | General business |
| Sales companies, professional services | Sales & client services |
| Beauty/salons, clinic administration | Appointment services |
| Gyms | Memberships & classes |
| E-commerce | Products & customer support |
| Restaurants | Reservations & menu enquiries |
| Service businesses, auto shops | Service requests & jobs |

The presets provide terminology, a suggested four-step customer journey, setup requirements and specific handoff/connection boundaries. They contain no customer records, credentials, prices, seat allowances or active automation. Advertised human-readable catalog names such as **Beauty & Salons**, **E-commerce** and **Photography Studios** now resolve correctly, with legacy aliases and the unknown-industry general fallback preserved.

The existing account-setup **Other** choice also resolves to the general preset. Its stored `other` value remains compatible; no replacement signup form or new onboarding step is introduced. Local provisioning checks include this legacy selection as well as the ten general/remaining-industry choices.

The shared general overview reuses approved purple cards, headers, badges, links and tokens. A single workspace module board replaces repeated quick actions. It links to existing CRM, conversations, business information, installed systems, eligible calendar views, connections, analytics, team and plan/usage pages only when current access permits. Missing/paused Appointment System setup and unknown evidence remain visible without claiming a usable calendar. Follow-up access follows the existing central plan definitions; included access does not imply activation. Read-only admin preview emits no actionable module URLs.

Mobile review also corrected narrow legacy AI/activity header links and moved the full entitlement list into a keyboard-accessible expandable section. All plan information and compare-plan actions remain available without occupying the whole overview by default.

The existing summary reader now records failed data sources instead of silently presenting all failed queries as empty. Failed counts/activity say unavailable, a genuinely unconfigured workspace says setup required, and loaded evidence says no recent issues recorded rather than claiming every provider is running normally. Failed subscription reads cannot make an organization appear to be an unsubscribed free workspace. Plan badges say **Included**, not **Active**, because entitlement alone is not activation.

The dedicated Real Estate, Photography and Hotel dispatch branches and operational workflows are retained. Preset metadata does not rebuild them or substitute a general dashboard for them.

## Files and reasons

| Files | Reason |
| --- | --- |
| `lib/industryExperience.ts` | Extend the existing registry with versioned preset metadata and safe canonical resolution of configured names. |
| `lib/portal-access.ts` | Add current ownership, installation status and failed-system-read evidence to the existing capability snapshot; preserve existing permission checks. |
| `lib/client-portal-data.ts` | Add unavailable-source evidence while retaining existing arrays, tenant filters and independent reads. |
| `lib/workspace-overview.ts` | Pure presentation selectors for permitted module destinations and truthful observed/setup/unavailable states. It authorizes no backend mutation. |
| `components/portal/WorkspacePresetPanel.tsx`, `.module.css` | Reuse shared purple components; adapt module cards, long text, touch targets and a native keyboard-accessible setup disclosure. No new client library. |
| `app/portal/page.tsx` | Integrate the general module board, correct misleading health/empty states, remove duplicate actions and keep owner activation/preview presentation separate. |
| `components/portal/PlanEntitlementsPanel.tsx` | Correct the entitlement label without changing plans or pricing. |
| `tests/general-industry-workspace.test.cjs` | Behavioral checks for all 12 catalog names, nine presets/general fallback, permissions, installations, plans, preview, failures and scoped reads. |
| `tests/client-workspace-provisioning-idempotency.test.cjs` | Reuse the existing local provisioning database fixture to verify all ten general/remaining-industry identities, replay safety and zero automatic agent/paid activation. |
| `tests/industry-presets/*`, `playwright.presets.config.ts`, `.github/workflows/industry-presets.yml` | Synthetic rendered verification across six widths and repeatable CI. No production/provider credentials or public image uploads. |
| `tests/dashboard-phase5-client-command-center.test.mjs` | Follow the module-board hierarchy while retaining tenant/data/access assertions. |
| `tests/real-estate-customer-service-window.test.cjs` | Reuse #422's exact existing normalizer fixture/precise validation assertion so the unchanged Real Estate implementation can actually run its full regression suite. |
| `package.json` | Register targeted and support verification commands; retain existing scripts. |

## Verification

Exact command results and final CI are recorded in the PR description. Logs remain under `/tmp/preset-*.log`. No test starts a real trial, contacts a customer, places a booking, charges an account or deploys automation.

- `node tests/general-industry-workspace.test.cjs`: seven behavioral cases.
- `node tests/client-workspace-provisioning-idempotency.test.cjs`: existing retry/ACL/identity cases plus ten industry/general workspace creations and retries in PGlite. The existing RPC/migration infrastructure is reused. No agent families/projects are created and all fixture wallets remain paused with zero balance.
- `npm run test:industry-presets`, `npm run test:support`, `npm run test:maia`, `npm run test:real-estate`, `npm run test:xposure-dashboard`, `npm run test:hotel-setup`, `npm run test:billing`: focused and existing workflow regressions.
- Changed-file ESLint, `npx tsc --noEmit`, `npm run build`, whitespace validation and a separate full lint inventory. Full-repository lint completed with 483 errors and 74 warnings; existing main previously had 492 errors and 74 warnings. Changed-file lint passes; unrelated debt is not reported as passing.
- Before: `PRESET_CAPTURE_BEFORE=1 PRESET_APP_ROOT=/tmp/flux-preset-before PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test --config playwright.presets.config.ts` captured **60 real rendered baseline-audit screens**, with **42 new-only states intentionally skipped**, at 360/430/768/1024/1440/1920px. These are not newly approved visual baselines.
- After: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test --config playwright.presets.config.ts` passed **102/102 cases**: all ten presets, restricted roles, missing/paused/unavailable system setup, operational outages, unknown industry, mobile navigation, reduced motion, 125% CSS zoom and manager activation controls. CSS zoom is not native browser chrome zoom certification.
- All 18 comparisons for the three dedicated dashboards passed against their retained screenshots without updating baselines.
- A temporary local integration with #422 and final #423 is tested separately. Their package/test-script additions must be combined deliberately; no PR is merged into main during validation.

Screenshots remain under `test-results/preset-evidence/{before,after}/` (ignored). Filenames include industry/state and width. Before images preserve actual old defects and do not redefine approval. New captures are review evidence, not stakeholder-approved replacements for the existing baselines. Synthetic organization names and keys are used throughout.

## 12ui review and preservation decisions

The workspace connection was authorized. The existing approved Phase 2 purple reference was inspected alongside the rendered general workspace. A first comparison dispatch encountered a service idempotency-key collision and explicitly purchased nothing. One explicitly keyed reference conversion completed (`3fffa037-3f9e-4973-bc7c-10f0d2da58e6`); the completed LayerDoc was then reused for the image-only review with no further image purchase.

All requested review stages settled in `/tmp/flux-preset-design-review`. The comparison is **unanchored, with no DOM/source coverage**. Its token patch reports no recurring CSS-capable deltas. This is not a claim of pixel-perfect matching or a hosted source audit. Neither repository code nor credentials, authenticated URLs or customer data were supplied to 12ui.

The extracted assets and the 82 independent target specifications were reviewed, not blindly applied. The reference's onboarding progress, completed indicators and routes describe a different screen and would fabricate product state here. Its alternate raster logo would replace the existing Fluxknight logo; the background plate adds a large decorative layer; its support/workflow icons would duplicate established navigation and icon components. The user's explicit instructions to preserve branding/workflows, avoid decorative effects and never invent status take precedence over those generic kit instructions. The implementation retains the existing logo/icon set, purple tokens, operational copy and shared components. No raster imitation of reference controls or unverified completion UI was introduced.

## Remaining scope and release gates

- This delivers the general workspace and preset configuration foundation. It does **not** create missing inventory, order fulfilment, membership billing/class capacity, repair/job dispatch or clinical-record engines. Those require their existing/approved connected systems and separate scoped implementation. The UI says so instead of displaying fake working modules.
- No generic catalog editor or new industry database was invented. Business information links to the existing review/settings surface; specialist catalogs remain in their supported workspaces/systems.
- No production migration is needed for this preset work. Current industry assignments and customer data remain untouched.
- #423's owner/trial protections and separately reviewed seat migration remain prerequisites for a coordinated release. The trial API gap discovered during this work was fixed and tested in that existing branch, not duplicated as a competing permission layer here. Do not release this branch as an excuse to skip Phase 4's migration/custom-role/hosted-acceptance gates.
- Authenticated hosted owner/manager acceptance and stakeholder screenshot approval remain separate from local synthetic verification and a reachable preview login.
- Review the exact final commit, CI, preview and rollback before any production merge/deploy. The user has authorized implementation and review, not production release.

Rollback: this phase changes application presentation/configuration only. An approved application rollback restores the prior deployment without reversing schema or touching customer data. Keep stronger approved Phase 4 access restrictions when coordinating any rollback; do not restore unsafe grants merely for compatibility.

The before worktree was captured at the exact base commit and was later reused for isolated after checks. Recreate a clean checkout at the base to repeat the original capture; do not treat that temporary directory name as proof of its current source. [Machine-readable evidence](phase5-general-template-evidence.json) records final counts and source hashes.
