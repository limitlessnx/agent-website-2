# Limitless Realty release checkpoint

**Updated:** 25 October 2026, 22:51 Europe/London
**Production app:** `main` commit `7e00465`, deployed READY; live alias probes returned HTTP 200.
**Production database:** 21 feature migrations plus one narrow real-estate permission-scope guard applied to FLUXNIT, in addition to the earlier workspace-provisioning ACL hotfix.

## Trigger gate

The automatic Trigger deployment run `40235468479` failed before deployment in the `npm run test:support` regression gate. The sanitized failures were the safe Google Calendar/client-onboarding and Leo security test files; no Trigger deployment occurred.

Follow-up changes are on `fix/onboarding-trigger-regressions-20261025`, outside Production. Workspace setup preserves safe internal post-auth destinations and payment/trial context. Generic Leo actions with any non-`none` approval mode now fail closed; a caller-supplied `confirmed` boolean is not treated as approval. Real-estate mutations retain their existing server-issued one-use database approval path. The shared Leo gateway and internal executor both gate before dispatch/execution.

The focused onboarding plus Leo tests pass **54/54**; the focused Leo security file passes **12/12**, including the forged-confirmation gate; and the canonical tenant-neutral suite passes **232/232**. Scoped ESLint and `git diff --check` pass. The next release step is to move the safe patch to the integration branch, run exact-head checks and isolated Preview, then merge a follow-up PR when green. After merge, verify the main Trigger workflow and deployment, then check live scheduled-task health.

## Database and remaining risks

The Production catalog postflight found the expected 42 core tables and 60 policies; 16 new feature tables have RLS enabled and critical service-only RPC grants were verified. A separate read-only audit found 42 pre-existing broad grants on shared onboarding/admin/billing/payment tables; they were not changed in this release and need a separate cross-tenant review.

Staging `rwewcnftxnaynpotbsms` was intentionally bypassed at the user's direction; it still has no application schema and received no DDL. Therefore privileged staging E2E has not been performed. No n8n change, real customer message, or customer-data copy occurred. No excluded/Xposure source or configuration was read or changed.

For the exact migration ledger, postflight queries, CI evidence, and residual gates, see [the Production rollout report](PRODUCTION_ROLLOUT_STATUS_2026-10-25.md).
