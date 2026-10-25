# Limitless Realty Production rollout status

**Updated:** 25 October 2026, 22:51 Europe/London
**Repository:** `limitlessnx/agent-website-2`
**Production code commit:** `7e00465` (PR #281)

## Production status

PR #281 was merged to `main` as `7e00465`. The Vercel Production deployment for that commit reached **READY**, and status-only HTTP checks against the live aliases returned **200**. This confirms the web deployment, not every runtime workflow.

On FLUXNIT, the 21 reviewed feature migrations and one narrow real-estate permission-scope guard were applied, in addition to the previously authorized workspace-provisioning ACL hotfix. The local migration filenames have been reconciled to the exact remote ledger versions. Catalog-only postflight found the expected 42 core tables and 60 policies; a focused check confirmed the 16 new feature tables have RLS enabled and verified the critical service-only RPC grants. No customer rows were copied or inspected for this postflight.

The separate dependency audit found **42 pre-existing broad grants** on shared onboarding, admin, billing, and payment tables (24 anon privileges and 18 authenticated write privileges). They were not changed in this real-estate release because a blanket revocation could break shared flows and other tenants; they remain a separate cross-tenant security item.

## Trigger workflow failure and follow-up

The automatic main-branch Trigger deployment workflow, run `40235468479`, failed in its pre-deployment `npm run test:support` gate. The sanitized failures were confined to the screened Google Calendar/client-onboarding contract and shared Leo security test files. The Trigger deployment step did not run; no Trigger deployment was made.

Follow-up changes on `fix/onboarding-trigger-regressions-20261025` preserve safe internal post-auth destinations and payment/trial context. Every generic Leo tool whose approval mode is not `none` now fails closed at the public gateway and internal executor; a caller-supplied `confirmed` boolean is not proof of approval. Real-estate mutations retain their existing database-backed, server-issued one-use approval flow. The follow-up is not in Production; carry it through the safe integration PR workflow before merging.

The focused onboarding plus Leo tests pass **54/54**; the focused Leo security file passes **12/12**; the canonical tenant-neutral `npm run test:real-estate` suite passes **232/232**. Scoped ESLint and `git diff --check` pass. The full broad `test:support` suite was not rerun locally because it exceeds the screened tenant-neutral scope; the automated main workflow is the gate for that suite after merge.

After the scoped PR checks and isolated Preview pass, merge the follow-up PR. Then verify that the main Trigger workflow passes its regression gate and that the Trigger deployment step completes; separately verify live scheduled-task health. Do not edit n8n or send real customer messages as part of that verification.

## Staging and tenant boundary

Staging project `rwewcnftxnaynpotbsms` was intentionally bypassed at the user's direction and still has no application schema; no staging DDL was applied. That leaves privileged staging E2E unvalidated, but it does not change the completed Production migration record above.

The 42 pre-existing shared-table grant findings require their own reviewed least-privilege migration and regression plan. No Xposure source/configuration or customer rows were read or changed; no customer-data copy, real outbound message, or n8n modification occurred.
