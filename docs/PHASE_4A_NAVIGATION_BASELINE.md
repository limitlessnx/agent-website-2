# Fluxknight Phase 4A Navigation Baseline

Baseline branch: `main`

## Purpose

Phase 4A establishes an authoritative, route-faithful navigation inventory without changing live navigation presentation, responsive composition, business logic, APIs, authentication, CRM, agents, campaigns, Leo, or database behavior.

## Protected baseline

The pre-Phase-4A live navigation implementation is preserved in commit `8e9cf4682c1bd71ba2dc05edd93fdca098f59aa1`.

## Canonical model

`components/admin/navigationConfig.ts` is the canonical inventory for the existing `AdminSidebar` navigation. It is intentionally not consumed by the live UI during Phase 4A.

The canonical model must preserve existing destinations exactly until a later phase explicitly verifies and changes them.

## Verified AdminSidebar inventory

### Fluxknight Platform

- Command Center → `/dashboard`
- Agent Leo AI Support → `/dashboard/support`
- Admin Notifications → `/dashboard/notifications`
- Evaluation Leads → `/dashboard/evaluations`
- Super Assistant → `/dashboard/agents`
- Global Activity → `/dashboard/activity`

### Home Agents / Limitless Realty

- Leads → `/dashboard/limitless/leads`
- Daily Briefs → `/dashboard/limitless/daily-briefs`
- Follow-ups → `/dashboard/limitless/followups`
- Properties → `/dashboard/limitless/properties`
- Knowledge & Media → `/dashboard/limitless/media`
- Campaigns → `/dashboard/limitless/campaigns`
- Agentic Systems → `/dashboard/limitless/agentic`
- Workflows → `/dashboard/workflows`
- Payments → `/dashboard/limitless/payments`

### Home Agents / Gencouv

- Overview → `/dashboard/gencouv`
- Email Control → `/dashboard/gencouv#email-control`
- Inbox → `/dashboard/gencouv#gencouv-inbox`
- Lead Board → `/dashboard/gencouv#lead-board`
- Sequence Status → `/dashboard/gencouv#sequence-status`
- Acquisition → `/dashboard/gencouv#acquisition`
- Operations → `/dashboard/gencouv#operations`

### Platform Governance

- AI Model Control → `/dashboard/ai-models`
- Knowledge Center → `/dashboard/knowledge`
- Memory Center → `/dashboard/memory`
- Platform Settings → `/dashboard/settings`

### Client Onboarding

- New Client → `/dashboard/onboarding#new-client`
- Onboarding Queue → `/dashboard/onboarding#queue`
- Client Registry → `/dashboard/clients`
- Client Workspaces → dynamic `/dashboard/clients?organizationId=<organizationId>` entries generated from tenants

### Public Website

- Homepage → `/`
- Services → `/services`
- Pricing → `/pricing`
- Industries → `/industries`
- Evaluation → `/evaluation`

Public Website links retain the existing behavior of opening in a new tab.

## Important distinction: WorkspaceRail

`WorkspaceRail` is a separate desktop workspace/context navigation surface. It is not merged into `ADMIN_NAV_GROUPS` in Phase 4A.

Its destinations must be independently verified before any Phase 4B+ consolidation or retirement. No WorkspaceRail destination is removed or replaced by the Phase 4A canonical AdminSidebar model.

## Important distinction: live components

Phase 4A does not migrate `AdminSidebar`, `MobileAdminHeader`, `MobileBottomNav`, `WorkspaceRail`, or Leo to consume the canonical model. That migration is intentionally deferred until route fidelity and ownership are verified.

## Active-route rules

The canonical helper strips hash/query portions for pathname comparison while retaining the original destination href. Exact matching is supported for explicitly exact entries.

## Dynamic client workspaces

Tenant workspace entries are generated through `buildClientWorkspaceNav()` so Phase 4A does not flatten dynamic organization-specific destinations into static configuration.

## Subsequent phase rules

1. Navigation presentation must consume the canonical model rather than inventing independent route lists where consolidation is approved.
2. No route may be removed merely because it is inconvenient to display.
3. Any stale destination must be verified against the repository and its intended behavior before removal or replacement.
4. Hash destinations must not be converted into guessed routes.
5. Responsive composition remains a later phase.
6. The working mobile drawer fix remains protected.
7. CSS ownership must not be changed through global overrides as a shortcut.
8. WorkspaceRail remains a separately verified navigation surface until its route ownership is resolved.
9. Legacy `MobileMenuButton` must be import-verified before retirement.
