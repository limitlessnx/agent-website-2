# Dashboard Final Phases 3–5 Plan

This branch completes the remaining dashboard work while preserving the current production behavior as the regression baseline.

## Guardrails
- Follow `skills/gpt-tasteskill/SKILL.md`.
- Preserve existing routes, copy, permissions, onboarding, auth, billing, credits, integrations, and working business logic unless explicitly changed by the approved phase scope.
- Keep the primary Fluxknight dark/violet theme.
- Avoid fake metrics and generic filler.
- Every live-data page must fail soft.
- Every organization-aware query must stay scoped to the active organization.
- Mobile must avoid horizontal overflow and maintain usable tap targets.

## Phase gates
### Phase 3 — Organization hardening
- Organization-aware navigation and module visibility.
- System organizations remain distinct from tenant organizations.
- Shared operational pages remain fail-soft.
- Regression test current production route and data contracts.

### Phase 4 — Tenant workspace completion
- Tenant-only quick navigation and operational command surface.
- Tenant data never exposes system-organization tools.
- Preserve onboarding/setup paths and admin permissions.

### Phase 5 — Client Business Command Center
- Redesign `/portal` into an outcome-focused client command center.
- Preserve client auth, tenant isolation, onboarding, integrations, credits, plans, and existing routes.
- Match Dashboard V3 hierarchy and responsive quality.

After each phase, update the automated contract suite and require a clean build gate before proceeding.
