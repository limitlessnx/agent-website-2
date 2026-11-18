# Organization manual upgrade and deletion controls

Added to the existing Phase 4 feature branch and PR #422, following a fresh main/open-PR check. No production operation was performed.

- The organization registry and organization management page now expose **Manual upgrade** and **Delete organization**.
- Manual upgrade loads active billing plans for the selected organization and reuses `SubscriptionControl` and the existing `/api/admin/subscriptions` assignment/wallet workflow. It requires explicit confirmation, collects no payment, and does not cancel a provider subscription. Archived organizations cannot be upgraded. Billing changes are tenant-scoped and audited with the initiating administrator.
- Delete is an explicitly described **archive**, retaining customer records, memberships and history. The administrator must enter the exact current organization name and a reason. Fluxknight, Limitless Realty and Gencouv are protected server-side as configured system organizations.
- Archive uses the existing `organizations.status = archived` state and existing runtime guards. It is idempotent and conditionally matches the selected row's ID, name, slug and previous status. A concurrent change causes a conflict instead of silently changing a different snapshot. The existing readiness engine marks archived/inactive organizations as needing attention and reports a lifecycle blocker. No hard-delete SQL, user deletion, migration, integration disconnection, provider cancellation or global schedule change was introduced.
- Audit intent must save before a mutation. A confirmed save remains visible if wallet synchronization or final audit recording fails; the response includes a review warning rather than suggesting an automatic retry. Unknown writes instruct the operator to refresh before retrying.
- Existing guarded tenant work is suppressed for inactive organizations. Already-running operations, other unguarded task families and external billing require separate review; this is not a claim of complete provider offboarding.

## Files and rationale

- `OrganizationAdminActions.tsx` reuses the approved purple buttons, dialogs, fields and focus behavior.
- Registry and management pages expose the shared controls using canonical organization identity.
- `SubscriptionControl.tsx` gains optional confirmation/current-plan/busy-state props; its established scale-center behavior is retained.
- The existing subscriptions route gains an authorized scoped options reader and audited, truthful mutation results. Plan/credit calculations are retained.
- The new organization DELETE route authorizes the administrator and verifies request origin; `admin-organization-archive.ts` implements the data-retaining archive and audit safeguards.
- `admin-request-origin.ts` verifies browser origin while supporting the existing reverse-proxy host behavior.
- Action runtime tests, browser tests and the updated management contract verify the new semantics.

## Verification

Eight new behavioral tests passed for authorization, typed confirmation, system protection, audit failure, tenant scoping, retries and partial outcomes. All 71 support regression files and four management/offboarding guardrail files passed. The three new action flows passed at 360px; the full 108-case six-width browser run and final preview/CI verification are recorded in the PR description when complete. Changed-file lint passed and the isolated build passed; final audit-error handling refinements are rechecked before delivery.

New dialog screenshots remain local under `docs/phase4/after/`. The existing public-image publication approval boundary remains in place. No live billing assignment, archive, deletion, customer communication or production deployment was performed during validation.
