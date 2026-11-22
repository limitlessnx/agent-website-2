# Limitless Realty branded media pipeline audit

Base: main `6feee013dc8973e60a4c9e302a326021573e1020`. Branch: `feat/limitless-social-branded-pipeline`. Latest main and open Social PRs inspected before editing. Do not overwrite #448, #407, #402, #401, #399, #393 or #392.

The previous Realty release was a researched/manual static-image draft studio. It did not implement parity with Fluxknight's weekly carousel and narrated-video mechanism. The shared carousel planner assumes Fluxknight; carousel colors and footer are fixed. The Reel storyboard assumes an automation company, and the renderer supplies Fluxknight's website. The shared Monday review dispatcher currently targets only Fluxknight. These must be parameterized rather than duplicated.

Production read-only audit found no registered Limitless Realty social logo, organization logo URL or website. Its existing Brand Brain has the real-estate strategy and explicit human-review/scheduling policy, but no approved visual identity. Logo/identity source and weekly format preference were requested. Do not invent an approved logo, website, voice or brand palette, enable billable automatic generation, or send public content while that input is pending.

Implementation order: approved organization-specific media identity and existing asset registry; shared carousel/Reel parameterization; sourced weekly planning on the existing planner/queue; primary control-center/readiness UI; separate manual-generation route; isolated functional, provider-mock and six-width tests. Preserve Fluxknight's existing template and publishing behavior. No new migrations or parallel publisher.

User clarification: start with carousels; videos are deferred. The current release must not modify or activate the Reel/narration pipeline. Weekly concepts will be carousel-only, with manual generation on its own route.

## Implemented carousel-first mechanism

- Logo approval is tied to the active brand's registered, ready PNG asset. A changed logo invalidates media readiness until reapproved. No website or company palette is invented.
- Approved background/surface/accent/text colors, footer and website are validated. Text and accents need adequate contrast. The first release explicitly uses the renderer's bundled Geist font; arbitrary custom font uploads are not implemented or advertised.
- The shared weekly planner researches seven sourced carousel concepts and queues the existing carousel renderer. The same Monday schedule can prepare Realty batches only after an explicit organization-specific opt-in; its default remains off. Publishing still requires review and explicit scheduling through the existing account-scoped publisher.
- The existing weekly-run table records planning, generation, partial failures and media-ready results. A planning failure never becomes an empty successful batch. Media failures retain saved concepts and prior assets.
- The primary control center shows readiness and weekly preparation. `/dashboard/social/manual` holds manual ideas and ad hoc researched batches; `/create` retains compatible access to that manual workflow for Realty. Other organizations keep their existing Create UI.
- The carousel director receives Realty editorial policy and post sources. The shared slide template takes approved identity settings; Fluxknight's default template and prompt remain intact. No Reel, narration, Maia or Leo behavior is changed.

## Verification so far

- Existing Social source suites plus the new brand pipeline suite: 22 files passed; nine new brand/worker assertions passed directly.
- The nine assertions cover approval/contrast/URLs, missing/foreign/changed logos before paid calls, seven sourced review-only carousels, idempotent weekly retry, retained queue failures, actual shared task status, Monday opt-in, and the actual carousel worker's logo/palette/storage scope.
- Local browser suite: 72/72 passed across six widths before the final carousel-specific review-copy refinement; the affected manual-review checks are rerun after that copy edit. Controlled identity fields retain edits after validation errors. Queue acceptance is tested against a local fake Trigger endpoint, not a live worker/provider.
- An actual 1080×1350 cover was rendered locally using synthetic branding and inspected. It is a rendering test, not a proposed or approved Limitless Realty design. SVG test-logo text caused local Fontconfig cache warnings; rendering completed successfully. Production logos are validated PNGs.
- No production data, real logo registration, paid model/voice call, account authorization, public post or customer communication has been initiated in this workstream. Brand source/identity choice remains requested from the owner.

The owner selected carousel-first delivery. No approved brand source has been supplied yet. The code can be reviewed/deployed with generation gated, but real branded activation remains blocked by the owner's logo and identity approval. No real brand palette or logo has been created, registered or substituted.
