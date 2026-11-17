# Daily approved Instagram publishing

Fluxknight publishes one approved post daily at 18:00 Africa/Lagos (17:00 UTC).
`flux-social-daily-publishing-sweep` runs in production every five minutes with a
one-minute execution window and queues the serialized
`flux-social-daily-publishing-cycle` task. The cycle is scoped to the Fluxknight
organization and brand, checks active organization status and an explicit
`brand.metadata.daily_publishing.enabled` flag, and uses existing approved media.

Only reviewed/approved Instagram posts are eligible. The current week beginning
2026-11-16 is enrolled, along with all future approvals after activation.
Historical approved posts and the pre-existing overdue manual schedule are not
automatically adopted. Future approvals receive the next free future daily slot.
Existing pending/claimed/completed dates reserve capacity. Drafts, rejected
posts, unpublished narration/music reviews and previously published references
are excluded. Manual cancellations remain respected until a fresh approval.

Approval snapshots are checked when assigning dates and again before delivery.
Edits that invalidate approval cancel the automatic schedule. Existing manual
schedules are preserved. Missed dates move to a free future date rather than
publishing in a burst. The publisher cannot run early, uses only the active
approved media, and guards automatic job claims against duplicate delivery.
Ambiguous provider failures stop automatic retries and show an error in the
calendar so a person can check Instagram before retrying.

Configuration contains timezone `Africa/Lagos`, local_time `18:00`, an
`enabled_at` approval cutoff and `minimum_week_start` of `2026-11-16`. Pausing the
brand's daily flag stops automatic scheduling and publishing. Maia and other
production workflows are unchanged. Other platform publishers are not enabled.

Workflow dispatch `configure_daily_schedule=true` runs a schedule-only check:
verify the Instagram account with a GET, assign this week's seven future
slots, verify approval snapshots and daily spacing, and assert that no publish
jobs were created. It does not publish content before its assigned time.
