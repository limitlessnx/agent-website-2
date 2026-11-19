# Phase 7 — credit capacity visibility and billing read permissions

Base: main 802f48b448292c4eff37263adb6afd4dc742ae7f, released PR #432. Isolated branch: feat/phase7-credit-visibility.

## Audit and defects

The existing reservation migration is registered in production as 20261119082208. Its service-only get_flux_credit_availability RPC returns balance, reserved and available in one database observation. Existing billing views showed wallet balance as available, hiding held capacity. The tenant billing API checked a session but omitted the billing.view/billing.manage permission gate already used by its page. The tenant page also represented a failed credit-history read as an empty ledger.

No open PR was treated as completed work or overwritten. Existing purple cards, metric grids, authorization helpers and billing services are reused. No new design tokens, navigation, frontend package, financial system or migration are introduced. This is an incremental information correction, not a substantial dashboard redesign; no new 12ui reference or approved visual baseline is claimed.

## Change and files

- lib/flux-credits.ts: additive billing summary using the existing availability RPC. Validate integer/nonnegative amounts and available=max(0,balance-reserved). Use the RPC's balance for consistent displayed arithmetic after a concurrent debit. Unknown/error evidence is represented by null amounts and explicit unavailable status, never zero. Existing general wallet summaries and provider quota gates retain their behavior.
- app/api/portal/billing/route.ts: align read permission checks with the existing page; source tenant identity from the verified session, preserve trusted read-only admin previews, add public capacity totals and sanitize errors. No raw reservation/provider metadata is exposed.
- app/portal/billing/page.tsx and app/dashboard/billing/page.tsx: distinguish balance, reserved credits and availability; explain pending/review holds and unavailable evidence using existing purple components. Tenant ledger failures display an error instead of a false empty state. No rate, plan, top-up, adjustment or accounting action is changed.
- tests/portal-billing-access-contract.test.mjs: repair a pre-existing stale assertion expecting Link after the shared sidebar had already migrated to NavigationItem; retain capability gating and run the contract in billing CI.
- tests/flux-credit-visibility.test.cjs: behavioral arithmetic, concurrent balance observation, missing/invalid/error evidence, zero/over-held balances, API session/permission denial before reads, scoped permitted reads, preview compatibility and error sanitization.
- tests/phase4/start-fixture.cjs and tests/phase4/control-center.spec.ts: extend the existing synthetic browser harness with tenant/admin billing capacity, outage, fully held and failed-history states at all six widths. All providers/writes stay blocked or synthetic.
- .github/workflows/monthly-billing-verification.yml: watch billing changes and run the new behavioral cases/scoped lint within the existing pipeline.

## Verification and visual evidence

Initial local checks: 18 new behavioral cases, 34 combined wallet/visibility cases and 656 support cases passed. Scoped lint has no errors and the pre-existing unused planFromSubscription warning. Initial targeted rendered browser run passed 12 cases across 360, 430, 768, 1024, 1440 and 1920px. Screenshot review prompted a stronger card surface for the availability notice. The final browser cases additionally check a fully reserved balance and failed history; final source build, regression and hosted results are recorded in the PR before release.

The runner captures tenant-billing-capacity, tenant-billing-held, admin-billing-unavailable, tenant-billing-unavailable and tenant-billing-history-unavailable screenshots under docs/phase4/after at each width. These are real rendered pages with synthetic data. No authenticated customer access, full industry acceptance, approved visual-diff baseline or before/after baseline comparison is claimed. Screenshots are not automatically published as public artifacts.

Local root storage remains full. Commands and browser temporary files use the existing isolated memory-backed checkout and task-specific temporary directory, without deleting shared databases or changing customer data. An initial browser invocation failed to allocate its default /tmp cache; rerunning with task-specific TMPDIR resolved that environmental failure. Only successful runs count as passes.

## Release and remaining scope

Use the standing approval to merge/deploy only after exact-head lint, types/build, financial/regression and responsive gates pass. No production schema change, seed, backfill, real communication or billable provider test is needed. Confirm source-tree/deployment matching, domain assignment and read-only post-release authorization checks. Actual release IDs and results are recorded in the PR.

This increment exposes held credits; it does not implement manual reconciliation or adopt reservations across every channel. Unknown holds must not be released because of elapsed time or an operator's guess. Recovery controls need verified provider/result evidence, current organization authorization, initiating identity, outcome/audit history and safe idempotency before they can mutate financial state. Remaining Phase 7 work includes these recovery controls, other-channel adoption, period accuracy and designated authenticated/provider acceptance. No whole-phase completion claim is made.

An additional billing-related run initially passed 55/56 cases: the existing sidebar contract expected a Link component while unchanged main already used NavigationItem. The contract now checks the actual shared navigation component behind the same billing capability gate. This failure is not counted as a pass; the corrected related suite is rerun before release.

The corrected related suite passed 56/56. Final targeted browser verification passed 12/12 across all six widths, including funded/fully held capacity and unavailable capacity/history. Production build and exact-head hosted release checks remain required and are recorded in the PR.
