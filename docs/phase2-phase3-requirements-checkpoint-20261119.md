# Phase 2–3 requirements checkpoint — 19 November 2026

The user reposted the combined UI/motion brief as requirements to keep following during the active Phase 6 work. This checkpoint preserves that direction; it does not restart the application or declare the earlier phases fully accepted.

## Repository state verified before further work

Latest main is `c850347a1051a21909167518808fbff78387ff12`. Recent commits and open PRs were rechecked. GitHub confirms #406 (onboarding), #408 (purple foundation) and #413 (settings/motion) are merged. The local Phase 6 branch remains isolated and its staged implementation is preserved. Older delivery documents' unmerged statements describe their original checkpoints, not current GitHub status.

This is an evidence/source audit, not a new authenticated dashboard browser run. No additional UI restructuring or animation is introduced by the active branch.

## Milestone status against the reposted brief

| Milestone | Established evidence | Remaining acceptance |
| --- | --- | --- |
| A — Repository/UI audit | Existing Phase 2/3 audits, source layouts/navigation and test inventories exist; current merge/base/open-PR state rechecked. | Reconcile every mandatory screen/state against latest rendered evidence before claiming complete UI acceptance. |
| B — Purple design system | Scoped foundation tokens, existing Button/MetricCard APIs and DashboardPrimitives/Interactions are present on main. Purple identity and separate admin/tenant authorization are retained. | A shared component example does not prove every legacy page has migrated. Do not replace working industry pages or invent new navigation to close a checklist. |
| C — Settings/layout stabilization | Existing settings, campaign, agent, billing and integration tests cover long text, save/error/loading states and reusable geometry. | Hosted authenticated acceptance and a complete screen-by-state coverage inventory remain necessary. Do not change backend settings behavior for presentation. |
| D — Responsive shells | Existing fixture suites use 360/430/768/1024/1440/1920px and cover admin/organizations plus representative general, Realty, Photography and Hotel workspaces. | Synthetic rendered pages do not certify every operational industry workflow or every modal/table state in production. |
| E — Flux Motion | Existing CSS motion tokens, reduced-motion rules and eight-state AI presence are present. Tests exercise observed-state transitions with synthetic provider events. | Real microphone/provider/availability acceptance, every workflow/chart transition and lower-powered-device performance are not established by those fixtures. No fabricated activity or new animation library is permitted. |
| F — Validation | Prior build/type/focused-lint, source-contract, responsive and visual evidence is recorded by source commit. | Complete current-head mandatory coverage, stakeholder visual signoff, authenticated hosted acceptance and performance/native zoom gates before declaring the combined phase done. |

## Concrete evidence and limits

- `docs/phase2-evidence/verification.json` records 42 responsive and 42 visual cases at source `72cdb0361f6adee2be619b300c418294e0d1092a`, with `authenticatedPreviewBrowserVerified: false`. These are historical results, not reruns at today's main.
- `tests/responsive/dashboard.spec.ts` covers `/dashboard`, `/dashboard/clients`, `/dashboard/design-system` and `/portal`, with four industry/general fixture variants and shared interaction states. Existing visual hashes represent implementation review, not stakeholder approval.
- `tests/ui-motion/settings-motion.spec.ts` includes admin settings/billing/integrations/support, tenant settings/agents/billing/integrations/campaigns and a client-setup fixture. It covers long titles, failures distinct from empty lists, save/retry/dirty states, reduced motion and synthetic Leo/Maia state handling.
- The recorded Phase 3 text-scaling check uses 125% CSS zoom/font scaling. It must not be described as native browser-chrome zoom testing.
- Existing phase reports disclose historical whole-repository lint debt. Their counts belong to the recorded older commits; this audit does not claim a new global lint pass or a current error count.
- The source/evidence review did not establish a new critical UI failure. It also did not prove that every item above passes. Missing acceptance evidence remains explicitly open.

## Rules for the active Phase 6 branch

The branch changes backend trace propagation, tests, historical-release bookkeeping and review documents only. It does not edit CSS, page layouts, frontend controls, agent animations, provider configuration or message-delivery behavior. Existing shared-component, industry, tenant-authorization and commercial boundaries remain authoritative.

Any future substantial UI change must first follow the reposted order: audit/baselines → tokens/components and layout stability → responsive shells → restrained motion → complete validation. Use 12ui for significant UI evaluation, retain the approved purple identity, capture real rendered before/after evidence and verify all six widths. Do not use this backend PR's green tests as proof that all Phase 2–3 visual requirements are complete.

No main merge, production deployment, migration or customer/provider mutation is authorized by this checkpoint. Production release and billable provider acceptance retain their separate explicit-approval gates.
