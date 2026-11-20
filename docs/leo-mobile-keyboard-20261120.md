# Leo mobile keyboard correction — 20 November 2026 (Africa/Lagos)

## Repository verification

Started from latest main `a0754a88463b42ed289e927a2c809f3d499baf1c`, merged PR #445. That release already contains the runtime email-capacity/settlement and Xposure writer-to-template review corrections; it was verified READY in Vercel production (`dpl_An6x1XNc9m4PedqjeFVvG7dzPt1Q`). It is not recreated here. Open PRs for Gencouv, Maia voice pilots and Flux Social remain untouched.

Branch: `fix/leo-mobile-keyboard-viewport`. No schema, credentials, provider configuration, billing behavior, tenant authorization or customer records change.

## Audit findings and corrections

The screenshot's greeting identifies `PublicLeoConsultant`. Its input was styled at 0.78rem, below iOS Safari's focus-zoom threshold. Chat geometry followed the layout viewport rather than the visible viewport and forced a 190px message row. A short viewport could also put the close control underneath the fixed public navigation; the open chat now sits above that navigation. Long unbroken replies could exceed the available width. Inherited button padding also compressed close/send SVGs to 0px/6px.

- `components/leo/useChatViewport.ts`: one presentation-only hook for visible height, width and panning offsets; resize/scroll events are coalesced into animation frames. It cleans up on close and supports browsers without VisualViewport. It never disables browser zoom or locks document scrolling.
- `app/leo-platform-ui.css`: bound public/admin/tenant panels to visible geometry, allow the message region to shrink and scroll independently, retain legible 16px-or-larger input text, preserve touch targets and icons, wrap long replies, avoid animating keyboard-driven position/size changes. A compressed public panel keeps its header close button while temporarily removing its duplicate launcher.
- `components/admin/MobileAdminPolish.module.css`: remove a competing fixed-height/bottom rule that overrode viewport handling.
- Public/admin/tenant Leo components: attach the shared geometry hook, preserve drafts and existing conversation/voice behavior, use focus restoration without page scrolling. Public header labels actual chat/voice mode instead of hardcoded ONLINE availability.
- `app/dashboard/support/AgentLeoClient.tsx`: scroll the message log instead of calling scrollIntoView on an anchor, which could scroll the page.
- `tests/ui-motion/leo-keyboard.spec.ts`, `playwright.leo-keyboard.config.ts`, package script and existing Leo CI workflow: rendered public/admin/tenant regression coverage with synthetic responses and blocked external requests.

The public WebRTC speech-timer code already triggered two React purity lint errors on unmodified main. Narrow comments suppress those two event-handler false positives; voice timing is unchanged. The existing unused `welcomeMessage` warning remains.

## Verification and evidence

The pre-fix 360px regression failed: header bottom 612px exceeded the simulated visible bottom 400px. [Before screenshot](leo-keyboard-evidence/before-keyboard-360.png) records that real rendered baseline. After images are review evidence, not approved golden visual baselines.

Keyboard tests simulate VisualViewport geometry and viewport-resizing keyboards; they do not emulate an actual iOS keyboard. They check composer/header containment, panned zoom, short landscape, browser-scaling availability, 16px input text, draft retention, close/reopen focus, independent message scrolling, long reply wrapping and synthetic message submission. Chromium covers 360, 430, 768, 1024, 1440 and 1920px. Hosted WebKit covers 360, 430 and 768px; local WebKit cannot launch because system libraries are unavailable.

Completed locally: 30 Chromium keyboard cases passed across all six widths; support regression runner 84 test files passed; focused AI-state/Leo permission/voice/Xposure/email-capacity group 7 test files passed; TypeScript passed; changed-source lint has zero errors and one existing unused-prop warning. An optimized local build also passed; final candidate build and hosted release results are recorded in the PR after execution.

## Remaining acceptance boundaries

Physical iPhone Safari keyboard behavior still needs device confirmation; synthetic/headless evidence is not that confirmation. No authenticated production customer screenshots or real-provider messaging tests are claimed. Owner/manager acceptance and ElevenLabs remain deferred by the user. This increment does not certify every master implementation milestone complete.

Production is unchanged while this branch is under verification. Release status will be recorded only after exact-head checks, preview verification and the authorized merge/deployment complete.

## Rendered synthetic screenshots

| Width | Public chat with simulated keyboard |
| --- | --- |
| 360px | [After](leo-keyboard-evidence/after-keyboard-360.png) |
| 430px | [After](leo-keyboard-evidence/after-keyboard-430.png) |
| 768px | [After](leo-keyboard-evidence/after-keyboard-768.png) |
| 1024px | [After](leo-keyboard-evidence/after-keyboard-1024.png) |
| 1440px | [After](leo-keyboard-evidence/after-keyboard-1440.png) |
| 1920px | [After](leo-keyboard-evidence/after-keyboard-1920.png) |

Additional 360px evidence: [admin](leo-keyboard-evidence/after-admin-keyboard-360.png), [tenant](leo-keyboard-evidence/after-tenant-keyboard-360.png), [panned zoom](leo-keyboard-evidence/after-zoom-360.png). The area beneath the simulated visible boundary is ordinary page content, not a rendered operating-system keyboard.
