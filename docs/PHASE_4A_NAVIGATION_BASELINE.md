# Fluxknight Phase 4A Navigation Baseline

Baseline branch: `main`

Phase 4A establishes a canonical navigation model without changing navigation presentation, responsive composition, business logic, APIs, authentication, CRM, agents, campaigns, Leo, or database behavior.

## Authoritative model

`components/admin/navigationConfig.ts` is the canonical route/group model for the next navigation phases.

## Protected existing systems

- `AdminShell`
- `MobileNavigationProvider`
- `AdminSidebar`
- `MobileAdminHeader`
- `MobileBottomNav`
- `WorkspaceRail`
- Leo floating utility
- Existing routes and destination components

## Rules for subsequent phases

1. Navigation presentation must consume the canonical model rather than inventing independent route lists.
2. No route may be removed merely because it is inconvenient to display.
3. Any route discovered to be stale must be verified against the repository before removal or replacement.
4. Responsive composition is a later phase. Phase 4A does not redesign desktop or mobile navigation.
5. The working mobile drawer fix remains protected.
6. CSS ownership is addressed only when a later navigation change requires it; do not add global overrides as a shortcut.

## Current navigation concerns carried into Phase 4B+

- Multiple presentation surfaces exist: sidebar, WorkspaceRail, mobile header, mobile bottom navigation.
- A legacy `MobileMenuButton` custom-event implementation exists and must be import-verified before retirement.
- Multiple dashboard/mobile CSS authorities exist and must not be consolidated blindly.
- Sidebar group state should eventually reflect the active route.
- Navigation layering/z-index should eventually have a coherent hierarchy.
