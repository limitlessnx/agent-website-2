# Fluxknight weekly review

The production-only `flux-social-monday-review` schedule runs Mondays at 07:00 UTC.
It calls `flux-social-prepare-review-week`, scoped to the Fluxknight organization
and brand, only when brand metadata `weekly_review_enabled` is true and the
organization is active. It refreshes Meta metrics and learning first; a provider
outage is logged and does not invent new evidence or stop drafts.

The shared planner saves seven Instagram drafts, one for each
industry: gyms, hotels, beauty and spas, real estate and service businesses, plus one workflow demo and one FAQ or practical insight.
It uses the Brand Brain, Leo CTAs, recent posts and the latest metric snapshot
per post/platform. It queues the verified v1 carousel renderer and the narrated Reel pipeline according to the effective format mix. The unique
organization/brand/week constraint protects against duplicate weekly plans.
Existing batches are retained rather than regenerated.

Review defaults to the current Monday in UTC. Select another week or all posts
to review older or standalone content. Review copy and complete slides, approve
each post or return it to draft with feedback. Revised drafts can be sent back
to review. Approval remains separate from scheduling and publishing. No publisher
cron or other production workflow is enabled by this feature.

Seven is the approved Fluxknight cadence, configured in brand metadata
`weekly_post_count=7`; other brands retain the five-post default. Do not alter existing plans. Analytics are exploratory with small samples;
leads and revenue require real attribution, not inference from engagement.

For a controlled current-week preparation, dispatch Deploy Trigger.dev with only
`prepare_review_week=true`. This does not approve or publish any post.


From the week starting 2026-11-23, Fluxknight brand metadata
`weekly_format_mix={effective_week_start:"2026-11-23",carousel:4,reel:3}`
enforces four carousels and three narrated Reels. The workflow demo is a Reel.
Earlier weeks retain their original format and existing plans are never rewritten.
The planner rejects a batch with the wrong mix before saving any posts.
Videos automatically queue `flux-social-prepare-reel`, which generates the same
structured storyboard used by the manual flow, then calls the existing narrated
Reel renderer. Licensed default brand music is used when available. Missing
music remains visible in Review and blocks final approval under the existing
rules. Narration and post approvals remain human decisions. No publishing task
or other organization's workflow is enabled by this configuration.
