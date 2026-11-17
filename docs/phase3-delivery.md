# Settings, long content and Flux Motion

Branch: `feat/fluxknight-ui-foundation-motion`. The user brief is preserved in [phase3-brief.md](phase3-brief.md); the pre-edit audit is [phase3-audit.md](phase3-audit.md). Earlier Phases 1/2 were separately approved, merged and released. This new UI phase is isolated and has no production-release approval.

## Existing architecture and implementation

The released purple tokens, shared cards/headers/tables, admin and tenant shells and permissions remain authoritative. This implementation reuses them rather than rebuilding settings or adding navigation/business services. Framer Motion was already installed; the new motion uses CSS and no dependency was added. The unrelated main commit `04cd1f26` (ElevenLabs Maia property bridge) was merged unchanged; its extra Maia regression passes.

- `components/ui/dashboard-foundation.css`: scoped settings grids, logical section navigation, paired controls, action wrapping, checkbox dimensions, read-only values and full template titles. Shared motion durations cover presses, hover, cards, overlays and content entrances; reduced motion disables them. Existing sidebar/mobile routing is preserved.
- `app/dashboard/settings/page.tsx`, `AppointmentCapacitySettings.tsx`: reuse PageHeader/MetricCard, add the missing capacity anchor, distinguish loading/error/saved, offer safe local reset and load retry, and preserve the existing capacity endpoint/payload. Failed loading cannot enable a write using assumed defaults.
- `WorkflowRegistryClient.tsx`: reuse the existing MetricCard instead of joined label/value rows. Workflow registration/status/retry actions and payloads remain intact.
- `app/portal/settings/page.tsx`, `CustomerStagesPanel.tsx`, `AccountAdministrationPanel.tsx`: read-only business values remain fully readable, labels are associated, account controls no longer squeeze into narrow columns, errors are announced, failed section queries are disclosed, and stage reset retains its form reference across an async save. Owner checks, lifecycle confirmations and API payloads are unchanged.
- `CampaignComposer.tsx`: complete long template identifiers wrap, selection is exposed with aria-pressed, and request failures are distinct from empty template lists. No send behavior or provider contract changed.
- `lib/ai-presence.ts`, `AIPresence.tsx` and its CSS: passive reusable idle/listening/processing/speaking/executing/completed/error/disconnected display. It never starts an agent, opens a microphone or decides permissions. Idle is static. Only observed speech/playback drives wave motion. Acceptance, queueing and approval do not imply completion.
- `LeoRealtimeVoice.tsx`: existing connection/tool/lifecycle behavior remains. The visual display follows actual input speech and output-buffer playback events, respects microphone mute through a current ref and avoids equating a connected call with listening. No provider endpoint, microphone policy, tool approval or execution behavior was changed. Line endings were normalized while editing the mixed-ending legacy file.
- `MaiaRuntimeControl.tsx`: failed loads no longer display an enabled default; retry is explicit, stale loads are ignored, and save completion describes the observed settings write, not an invented agent outcome. Missing profile data is labelled as defaults.
- `DashboardPrimitives.module.css` and design-system examples: restrained dialog entrance with reduced-motion support, synthetic AI states and long property/organization/email examples. The examples are explicitly labelled synthetic and never initiate agent activity.
- `tests/ui-motion/`, `playwright.motion.config.ts`, state unit tests and package scripts: real Next/Chromium fixtures with synthetic keys, explicit route guards and intercepted stateful requests. Production/provider keys are not inherited; external browser traffic and mutations are blocked except locally simulated responses. Wallet RPCs are simulated in memory; no real billing, database write or communication occurs.

## Design reference and visual evidence

Four 12ui candidates were inspected. A was explicitly picked and converted into responsive HTML/LayerDoc. Its settings grouping/control alignment informs this incremental migration. The original Fluxknight wordmark, semantic icons, routes and real controls override generated replacement artwork or invented live indicators. [Selected reference](phase3-evidence/reference/settings-A.png).

The required post-implementation image-only comparison completed against the same LayerDoc. Its unanchored kit had no DOM/repository coverage or recurring token patch; no additional conversion was purchased. It does not establish pixel-perfect full-shell matching. No repository, credentials, cookies or customer data were sent to 12ui.

The before capture set contains nine routes at six widths. Initial billing/systems error-boundary captures are labelled audit defects, not baselines; corrected fixtures/captures are separate. Final screenshots use long organization/email/template content. Full-page images reposition fixed chrome as part of the capture; viewport attachments and interaction checks supplement them. New images are implementation evidence for review, not stakeholder-approved regression baselines.

[Before](phase3-evidence/before/) · [Corrected baseline routes](phase3-evidence/before-corrected/) · [After](phase3-evidence/after/) · [Machine-readable checks](phase3-evidence/verification/summary.json).

## Verification boundaries

The 90-case new browser suite passed at `e262ac97`; final settings alignment and fixture refinements received a separate 18-case six-width rerun. Final AI/long-content reruns and unchanged dashboard visual checks are recorded in the verification index. Existing core baselines are never silently updated. The intentionally expanded design-system examples require new screenshot review and are functionally checked separately from the unchanged baseline comparisons.

Focused ESLint has zero errors and two existing Leo lifecycle-hook dependency warnings. Repository-wide legacy lint failures remain outside this UI scope. Production-like local compilation is checked separately from development browser fixtures. Native/hosted build results and exact commits are recorded in the verification index.

Synthetic WebRTC/provider results test actual component state handling without contacting a provider. No real microphone, paid voice/AI session, campaign, message or automation delivery was used to prove behavior. Text scaling checks use 125% CSS zoom/font scaling, not a claim of native browser chrome zoom coverage. Hosted authenticated operational acceptance remains separate from local fixture verification and public preview reachability.

## Production status

No production deployment, main merge, migration or customer-data change was performed for this next UI phase. The earlier approved phase rollout and empty industry starter registrations are recorded in [the release report](releases/phase1-phase2-rollout.md). Any production release of this branch requires a separate explicit approval.

## Final refinements and retesting

Runtime source `34a93b0f` adds the settings-only specificity correction and explicitly labels edited Maia fields as unsaved. The final native build passed for that source. Six-width reruns passed: settings 18/18; AI/long-property content 18/18; Maia unsaved/save-failure/retry 6/6; expanded shared-component keyboard/dialog/drawer checks 6/6. The initial 90-case run remains scoped to its recorded source instead of being retroactively relabelled.

The unchanged-dashboard visual run initially produced 34 passes and two mobile overview mismatches. Inspection showed only the morning/afternoon greeting differed. The test now fixes both fixture-server and browser clocks, plus signed test timestamps, to the original reviewed morning capture time, without masking product content or changing the application's greeting. Affected overview comparisons are rerun separately. An earlier browser-launch attempt omitted the system Chromium path and did not launch; it is not reported as a product regression or a pass. No baseline image was changed.


## Final results

- Support: 69/69 files passed; Maia including the preserved main bridge: 19/19; Hotel setup: 11/11; AI presence unit file passed, including queued-versus-running distinction.
- New responsive suite: 90/90 at the recorded earlier source; final targeted six-width checks passed for settings (18), AI/property content (18), Maia unsaved/error/retry (6) and workflow outage (6).
- Existing shared-component interaction checks: 6/6 passed. The design-system page intentionally gained clearly synthetic examples and is not compared against its superseded screenshot.
- Existing admin/tenant/industry visual scenarios: 36 distinct cases validated without baseline changes. The deterministic full run passed 35/36; the remaining tablet organization case had an internal Next development-router initialization error and passed a clean focused rerun. Earlier mobile greeting differences were corrected with a fixture clock, not baseline updates or masking.
- Final TypeScript passed. Focused ESLint has zero errors; two pre-existing voice lifecycle-hook warnings remain. Native build passed at `154f67dc`; the final small queued-state helper change at `eddf8225` passed its unit and TypeScript checks, and the final hosted preview build remains a gate at the time of this local report (see PR checks for its outcome).
- Workflow registry failures are projected immutably and shown as unavailable instead of zero/empty; only that section is unavailable. Chart entry motion attaches to the existing RevenueHero stylesheet, has no data/refresh behavior and respects reduced motion.

No production release of this UI branch has been performed. The preview/PR are review artifacts; authenticated hosted acceptance remains separate from fixture evidence.
