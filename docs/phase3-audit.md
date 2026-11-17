# Settings, long-content and Flux Motion audit

Base: released main `1df3d061`. Branch: `feat/fluxknight-ui-foundation-motion`. The preceding onboarding and purple-foundation PRs are merged and deployed; their architecture/evidence remain in the existing phase reports. Open PRs concern Flux Social, Maia delivery fixes and unrelated product work; do not merge or overwrite them.

## Existing foundations

Reuse `components/ui/dashboard-foundation.css`, `DashboardPrimitives`, `DashboardInteractions`, AdminSidebar, PortalSidebar and existing focus-trap hooks. Tokens, responsive shells and industry overview migrations already exist. Framer Motion is already installed; simple refinements should use CSS rather than another dependency. Platform/tenant permissions and routes remain separate.

## Rendered baseline and limitations

An isolated Next/Chromium fixture captured nine existing routes at 360 and 1440px before UI edits: platform settings/integrations/billing, tenant settings/integrations/billing, Hotel campaign templates, tenant agents and Leo. Initial results: 18 HTTP-200 captures, no browser page errors or document overflow; the subsequent full run captured 54 images. Follow-up inspection found that billing and systems error boundaries could return HTTP 200, so those three routes are explicitly excluded as valid rendered baselines until their synthetic fixtures are corrected. The agents route intentionally redirects to the existing systems workspace. These are audit images, not approved visual baselines. Fixture writes/external requests are blocked. Full-page captures place fixed navigation at its viewport location and therefore do not alone establish control occlusion during scrolling.

Observed defects despite no page overflow:

- Platform capacity Save action is squeezed into its fixed-width input row; its text extends/clips at small widths.
- Workflow-registry metric values run together without spacing; settings mixes several legacy card/header/form styles.
- Settings section navigation lacks the capacity section and places a long navigation row in a clipped rail.
- Tenant checkbox controls inherit large generic input sizing. Read-only business fields look editable, and labels are not programmatically associated.
- Account lifecycle rows squeeze action labels, textareas and transfer email fields into narrow columns. This is a presentation issue; do not change account lifecycle APIs or confirmations.
- The long campaign-template identifier is ellipsized without another way to read its full title. Selection state is visual only.
- The fixture lacks membership creation dates, causing an Invalid Date in the before capture. Correct fixture evidence rather than recording that as a product regression or approved baseline.

## State correctness findings

Leo's realtime UI equates any live connection with listening, even while muted or while output is playing. Idle orb styles continuously animate. MaiaRuntimeControl begins with an enabled default and renders it after a failed load. Correct these presentation states using existing events/results; do not alter agent tools, authorization, provider requests, microphone policy or execution semantics. Tool completion must require observed result/evidence; pending execution must not become completed for an animation.

## Implementation milestones

A. Audit and synthetic before captures (this document).
B. Reuse the released purple tokens/components; use 12ui with synthetic images only for the settings reference. No repository source, credentials, cookies or customer data go to 12ui.
C. Stabilize settings/forms, action rows and long template titles; preserve API payloads and every existing action.
D. Verify shared shells and six-width long-content states, including read-only fields and validation feedback.
E. Add reusable CSS motion tokens and a state-driven AI presence component; respect reduced motion and avoid recurring page entrances on background refresh.
F. Functional/regression, six-width browser, real-event state tests, before/after evidence and preview PR. No next-phase main merge or production deployment is authorized.

## Selected design reference

Four actual 12ui candidates were inspected; A was explicitly picked and its LayerDoc/responsive HTML conversion and implementation kit completed. The reference guides section grouping, quiet secondary actions and paired control alignment. It is image-only/unanchored: no repository or DOM/source coverage was supplied, and its token patch contains no recurring changes.

Under the user's preservation requirements, retain the existing logo and semantic icons instead of generated raster replacements. Specifically: keep the original Fluxknight SVG wordmark; reuse workspace/account icons; render real table values rather than the generated table-cell crop; omit invented running/live notification artwork because availability must come from real state. No added generated navigation, collapsed-away settings, typo copy or sample automation identifiers replace the working app. This is an incremental reference-informed migration, not a pixel-perfect replacement of the product shell.

## Fixture correction

Platform and tenant billing require wallet/commercial RPC results; the previous read-only fixture rejected those calls and rendered an error boundary. The fixture now simulates them locally without forwarding or persisting requests. Systems installation data now includes the required requested date and catalog capabilities. Browser tests reject `.flux-safe-error` rather than accepting HTTP 200 alone. Corrected baseline captures of those three otherwise-unmodified routes are recorded separately.
