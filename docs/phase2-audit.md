# Phase 2 audit — 17 November 2026

## Repository and Phase 1 gate

Latest origin/main was fetched before changes: `967f2821`. Open pull requests and recent commits were inspected; draft #406 contains Sprint 1 provisioning work. Its existence is not treated as verification. The current follow-up remains on the Phase 1 branch until checks finish. Phase 2 will be stacked on its verified commit, without merging main or deploying production.

The existing implementation uses Supabase tenant records and template assignments, legacy n8n starter provisioning, and Trigger.dev background tasks. Retry and readiness reuse those services. Admin and tenant authentication remain separate. Earlier approved production work installed the retry-safe creation overload and retained one explicitly marked QA organization with outbound automation disabled.

Remaining Phase 1 findings: Hotel readiness referenced a function absent in the production migration ledger; new Photography organizations failed the Xposure-only API gate; human-readable industry labels selected the generic workspace; Photography catalogue fallbacks displayed customer-specific sample counts. Follow-ups address these without customer-data writes. Photography/Hotel starter registration is prepared as reviewable SQL, not applied to production. Live activation and external communication tests remain intentionally unexecuted.

## Existing UI foundation

- AdminShell composes DashboardDesignSystem, EnterprisePlatform, SuperAdminDesktop, MobileAdminPolish, and DashboardReferenceFidelity CSS modules. Several redefine the same tokens and selectors. DashboardDesignSystem starts with purple `#07031a` / `#8b5cf6`; reference fidelity overrides surfaces to blue-purple `#0B0F24` / `#12193A` and brand `#7c3aed`.
- Tenant PortalLayout has separate authentication, membership capabilities, industry routing, portal.css, marketplace.css, and HotelMobileShell. These authorization boundaries must remain intact.
- Existing navigation systems are AdminSidebar with MobileNavigationProvider and PortalSidebar. Reuse their state and routes; do not introduce another navigation system.
- Existing Button, MetricCard, dialog focus utility, forms, table wrappers and toast patterns should migrate incrementally. Industry pages retain their unique workflows.

## Defects and risks observed in source

Multiple overlapping style layers, hardcoded colors and frequent important declarations make cascade behavior unpredictable. Breakpoints vary among 700, 768, 900, 960, 1024, 1050 and 1280px. Some mobile controls use 11px text. Card, page-header, table and button treatments are duplicated. The onboarding progress panel relies partly on browser-native progress styling. Portal navigation needs explicit keyboard/escape and focus-return verification. Dense action rows and long organization names need measured overflow checks.

These are source findings, not a claim that every route has failed a browser check. Previously captured Phase 1 setup screenshots establish only that route's six-width behavior; they do not prove the admin overview or industry dashboards. Broken before screenshots must be labelled audit evidence rather than approved regression baselines.

## Incremental implementation boundary

Consolidate semantic purple tokens and backward-compatible aliases; use approved 12ui output for the visual reference. Standardize shared component states and spacing, then migrate shared shells and representative components. Preserve industry content, operations, route permissions and all APIs. Test six viewport widths with synthetic data and deny external communications and mutations in fixture tests. Authenticated hosted verification must be reported separately from synthetic local verification.

## Current design reference status

12ui login succeeded, but its CLI default requested conversion scope only. Design generation returned `403 missing_scope`. A supported scope upgrade has been requested; no CSS approximation or unapproved baseline has been substituted for the required design checkpoint.
