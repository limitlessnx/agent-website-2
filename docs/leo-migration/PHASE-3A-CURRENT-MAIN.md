# Leo migration Phase 3A: current-main baseline

**Date:** 2026-10-23  
**Status:** Draft implementation; validation must pass before merge.  
**Production:** Unchanged.

## Scope
Introduce one provider-neutral dispatch seam for the privileged Leo tool gateway. Preserve the current signed-envelope executor as a compatibility adapter until action-specific Trigger.dev contracts and tests are ready.

## Guardrails
- Do not modify `main` directly or merge this draft before CI and review.
- Keep authorization, identity resolution, approval enforcement, tenant scope and audit in their existing canonical locations.
- Keep Public Leo lead capture, direct Super Admin inspection/orchestration handlers, and Limitless Realty-specific handlers unchanged.
- Do not remove n8n workflows, environment variables, callbacks or unrelated Maia/tenant provisioning integrations in this phase.
- Do not describe the migration as complete while the compatibility adapter remains in use.
- Reconcile this branch against current `main` before every further code batch and before merge.

## New implementation folder

Migration-owned execution boundary code now lives under `lib/leo-execution/` so provider adapters and contract tests can be added without scattering migration code through the shared `lib/` root. This folder is not a separate deployable service.

## Current implementation delta
1. Generic privileged Leo tool execution calls `dispatchLeoExecution(envelope)`.
2. `lib/leo-execution/dispatcher.ts` defines a typed provider interface and dispatch result.
3. `legacyN8nLeoProvider` retains current behavior as the default, deliberately avoiding an unverified provider cutover.
4. A static regression contract is added to `test:support`.

## Next required work
- Run targeted dispatcher/security tests, `npm run test:support`, `npx tsc --noEmit`, and production build in CI or an executable checkout.
- Inspect actual Trigger.dev SDK/task invocation conventions before implementing its adapter.
- Migrate CRM follow-up and appointment actions with stable idempotency keys and persisted execution evidence.
- Verify campaign executor ownership and define workflow lifecycle behavior explicitly; unsupported capabilities must fail closed.
- Only remove n8n after required runtime callers and external dependencies are proven absent.

## Validation disclosure
GitHub source inspection is not a test run. Do not merge or promote until checks have actually passed and the final diff has been reviewed against current `main`.
