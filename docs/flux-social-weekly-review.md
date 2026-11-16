# Fluxknight weekly review

The production-only `flux-social-monday-review` schedule runs Mondays at 07:00 UTC.
It calls `flux-social-prepare-review-week`, scoped to the Fluxknight organization
and brand, only when brand metadata `weekly_review_enabled` is true and the
organization is active. It refreshes Meta metrics and learning first; a provider
outage is logged and does not invent new evidence or stop drafts.

The shared planner saves seven Instagram carousel drafts, one for each
industry: gyms, hotels, beauty and spas, real estate and service businesses, plus one workflow demo and one FAQ or practical insight.
It uses the Brand Brain, Leo CTAs, recent posts and the latest metric snapshot
per post/platform. It queues the verified v1 carousel renderer. The unique
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
