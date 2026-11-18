# Phase 5 — General organization template and industry presets

Base: `main ae2a41f9031544f340ae9144bc79fb0c72819b8b`, inspected 18 November 2026. Open PRs and existing phase branches were reviewed before editing. Work is isolated on `feat/phase5-general-industry-presets`. No production deployment, customer-data edit, provider action or schema migration is authorized.

## Existing architecture and defects

- `lib/industryCatalog.ts` contains 12 offered industries; `lib/industryExperience.ts` already owns their terminology/features and the general fallback. Extend that configuration instead of introducing a second tenant/template registry.
- `/portal` already dispatches to dedicated Real Estate, Photography and Hotel dashboards. The other nine industries use the same general overview. Preserve the three dedicated branches and existing operational routes.
- The general overview's industry links derive only from feature booleans, ignoring the sidebar's current role/system installation checks. Several inventory links promise an industry operation but land on generic Systems; the general service catalog has no independent existing editor. Do not invent working order, membership or repair modules from those flags.
- Human-readable `Beauty & Salons`, `E-commerce` and plural `Photography Studios` catalog names do not reliably resolve to their registered experience. Canonicalize known configured names while preserving existing aliases and the general fallback.
- `getClientPortalSummary` converts failed queries to empty arrays. The general overview then interprets those arrays as healthy/zero activity. Add explicit unavailable-source evidence to this existing reader without changing its arrays or creating a second monitoring system.
- Shared purple cards, headers, status badges, buttons, native disclosures, responsive grids and reduced-motion rules are already approved. Reuse them. Industry pages and navigation keep their existing authorization/routing.

## Implementation scope

1. Add versioned, data-free workspace preset metadata to the existing industry experience registry: general, sales/client services, appointment services, memberships/classes, commerce, restaurant service, and jobs/vehicle servicing. Keep existing industry labels and special dashboards.
2. Add an incremental workspace panel to the general overview showing authorized existing modules, installation/configuration prerequisites and industry-specific setup guidance. Plans remain the source of chargeable feature access and APIs retain enforcement. A configuration description does not imply a new business engine is implemented.
3. Make shared-reader failures visible and stop calling missing operational evidence healthy. Do not disclose provider errors/secrets or fabricate setup progress percentages.
4. Test all nine non-specialized industries plus general at six widths, including unknown industry fallback, long content, restricted roles, missing installations, outages, empty state, navigation and reduced motion. Retain existing industry visual baselines.

## References and review gates

[HighLevel snapshots](https://help.gohighlevel.com/support/solutions/articles/48000982511-snapshots-overview) inform reusable configuration separated from customer records. [Odoo industries](https://www.odoo.com/all-industries) inform industry workflow grouping. They are research references, not imported code, assets or new platform dependencies.

12ui is used for the required design review; its workspace account connection has been requested. Existing approved Fluxknight purple components remain the presentation foundation. New visual evidence is synthetic and not automatically approved as a baseline or publicly uploaded.

Phase 4 remains separately reviewable in #422/#423; its production migration, custom-role review and hosted acceptance are not bypassed. A final global-role preservation safeguard has been published to #423. This independent template work does not merge or apply it. Before any combined release, resolve shared package/test changes deliberately and run integration checks.
