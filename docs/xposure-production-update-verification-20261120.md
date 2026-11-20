# Xposure production update verification — 20 November 2026

Xposure is the intended production tenant. News is only the designated non-customer test organization. This audit uses read-only, organization-scoped configuration/aggregate queries and synthetic tests; it does not impersonate an owner, initiate provider work or modify live customer records.

## Release and architecture

Latest main was fetched at `6748413` (merged PR #437). The production Vercel deployment for that exact commit is READY; the preceding release verified its matching Trigger.dev worker publication. Shared billing, purple dashboard primitives and request/credit-operation changes are deployed platform-wide; they do not require copying News data or a tenant-specific code installation.

Xposure's existing profile selects `photography-studio`, and its `xposure` workspace slug retains the dedicated studio dashboard/authorization path. Portal capabilities are derived from active membership permissions; plan features use the existing credit wallet/entitlement controls. Industry, role and plan remain separate concerns.

Relevant open drafts were reviewed: #288 (content-creation catalogue/booking CTA) and #269 (client profiles/enquiry pipeline). Neither is on main or included in this repair; their prerequisite review gates remain intact. Separate Gencouv/voice/Social work was preserved.

## Read-only findings

| Area | Observed configuration | Meaning |
| --- | --- | --- |
| Organization | Active, Photography onboarding profile | Correct existing photography shell selection |
| Owner access | One active owner with billing view/manage, systems view/manage and member management | Shared billing and studio controls are permitted by recorded role data; this is not an authenticated UI acceptance test |
| Credits | Active funded Basic wallet | Existing prepaid AI controls apply; no allowance, balance or plan was changed |
| Subscription/packages | No subscription, service-package assignment or entitlement overrides | New readiness cannot certify subscription/package setup; additional plan features must not be silently unlocked |
| Industry assignment | Active **Computer Service AI Suite**, while profile is Photography | Actual configuration mismatch; the old readiness engine incorrectly accepted any active assignment |
| Agents | Published Maia plus five draft agents; no runtime-readiness rows | Preserve the published concierge. Draft agents and missing readiness evidence are not successful activation |
| Catalog | Six photography categories; no active photography or legacy studio items | Category covers alone are not configured service packages; business-approved offers/prices are still needed |
| WhatsApp | Stored connection is marked connected; last check is from 21 October | Configuration evidence only; live provider health was not tested |
| Tests/deployment evidence | No agent test-run evidence or organization provisioning/system rows | Do not invent approval, readiness, deployment or provider health from their absence |
| Onboarding | Configuration stage | Must not mark live/complete merely because the shared release shipped |

## Code defects corrected

1. `lib/tenant-readiness-server.ts` now compares **active organization template assignments** with the tenant industry's existing canonical aliases and checks that template definitions are active. Unrelated unknown labels retain their own identity rather than both becoming “general.” A wrong active assignment reports Needs attention and cannot be bypassed by a legacy published-family fallback. Archived/inactive history is ignored; failed and unfinished assignments still block readiness.
2. Photography catalog readiness now reads both existing stores: `photography_catalogue_items` (tenant operational pages) and `studio_catalog_items` (legacy admin studio pages). Reads remain scoped by organization and active status. Query failures remain explicit unavailable evidence. No catalog data is copied or seeded.
3. `tests/tenant-industry-readiness.test.cjs` exercises real readiness evaluation for matching/mismatched industries, unknown/missing labels, active/draft templates, failed/provisioning assignments, both catalog paths, empty/error states, tenant scoping, and Real Estate/Hotel preservation.
4. `tests/tenant-onboarding-reliability.test.cjs` supplies the real industry alias module to its existing error/isolation fixture. `package.json` includes the new guard tests in the support and industry-presets suites, including the existing Trigger deployment verification path.

This is a read-only readiness correction. It does not apply a new starter, change entitlements, redeploy a customer's external automation or activate an agent.

## Xposure setup still requiring correction

The correct existing starter is **Photography Studio AI Suite** (`photography-ai-suite`). The mismatched Computer Service assignment must be retired through an audited, tenant-scoped repair, retaining existing published Maia and customer-owned configuration. Simply changing a template pointer would falsely claim the Photography starter was provisioned. Blindly rerunning the legacy provisioner would create draft agents/workflows and includes a legacy shared workflow namespace; review the existing tenant-UUID completion path before repairing this live workspace.

Then configure actual service packages, capacity/availability and approved knowledge; record the intended subscription/entitlements; obtain current test and activation evidence. Preserve current Basic access until a different plan is deliberately selected. Do not synthesize subscriptions, credits, packages, approvals or manager membership just to make readiness green.

News remains the synthetic/non-customer test target. Live Xposure browser acceptance requires an authorized owner/manager session; connected authenticated browser tooling is unavailable here. No production session is forged and no live customer communication or provider test is run.

## Validation

- Targeted onboarding/readiness/industry checks: **48 passed**.
- Photography dashboard/booking/authorization, campaign, team, industry and billing regression group: **200 passed**, zero skipped. Suites overlap; counts are not additive unique-case totals.
- Changed-module ESLint passed with zero errors/warnings; TypeScript and optimized production build passed. Hosted release results are recorded in the PR.
- No new layout or animation system is introduced. Six rendered mismatch checks passed at 360, 430, 768, 1024, 1440 and 1920px. See [synthetic visual evidence](xposure-readiness-evidence/README.md). No authenticated Xposure screenshots or live paid/provider acceptance are claimed.

Production tenant configuration and customer data were not modified by this audit. Code publication/deployment is tracked in the linked PR rather than inferred from a local test result.
