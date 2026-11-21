# Limitless Realty Flux Social

## Architecture and audit

Implementation branch: `feat/limitless-realty-flux-social`. Initial base: `c194bb75355dd3c5fb0f4b90ca9ea13054d622fc`. Main subsequently advanced with unrelated Gencouv PR #449; preserve those changes when integrating. Open Social PRs #448, #401 and #362 were inspected, not merged or overwritten.

The existing social workspace, planner and provider controls assumed Fluxknight. Limitless Realty had no social brand or Meta connection. Existing `social_brands`, posts, assets, review, Vault integration credentials, schedule tables and publisher are sufficient; no migration or parallel provisioning/publishing service is needed.

The existing daily sweep dispatched Fluxknight's automatic queue only. It now also drains explicitly scheduled Limitless Realty intents, without creating automatic slots. Fluxknight's existing weekly/daily policies and results remain intact. Instagram Login tokens now use their corresponding account IDs without requiring unrelated Facebook Page credentials.

## Behavior and boundaries

- Exact organization: `b15f21b4-5697-4d21-9421-8a34eae3476d`. Setup requires an authenticated platform administrator in that active workspace. Platform privileges do not become tenant membership.
- Separate Brand Brain: Nigerian real estate, buyer education and relevant Edo State/Benin City coverage. No copying of customer data, Fluxknight promotional copy, listing facts, URLs or provider account tokens.
- Manual ideas create one draft. Research requires an actual completed web search and generates three drafts citing only retrieved URLs. Recent coverage is not represented as measured popularity.
- Drafts remain unapproved and unscheduled. The existing final-media review gate, static graphic renderer, approval and calendar are reused.
- Retry IDs deduplicate stored drafts and preserve saved/approved work. Audit failures retain saved drafts and give recovery instructions. Concurrent requests can repeat provider work before the first save; stored drafts are deduplicated, model billing is not guaranteed exactly once.
- Manual scheduling records approval and Instagram account snapshots. The sweep and publisher recheck scope, active organization, media, approval and account. Ambiguous delivery requires reconciliation rather than an automatic second public post.
- Default autonomous weekly/daily publishing is disabled for Limitless Realty. No real research, generation, public posting or customer communication occurs in the test fixture.
- Existing Fluxknight, Maia, Leo, CRM, lead categories and industry workflows are preserved. No customer records are migrated or deleted.

## Files

| Area | Files and purpose |
| --- | --- |
| Strategy and generation | `lib/social-real-estate-policy.ts`, `lib/social-real-estate.ts`: own defaults, sourced research, manual drafts, validation, deduplication and audits |
| Authorization | `lib/social-real-estate-access.ts`: server-resolved administrator/workspace boundaries |
| Studio | `app/dashboard/social/real-estate-actions.ts`, `components/admin/RealtySocialCenter.tsx`, `RealtySocialDraftForm.tsx`, existing social layout/home/create: reuse dashboard identity and recoverable forms |
| Discoverability | `lib/admin-organization-data.ts`, `DashboardHomeExperience.tsx`: configured content agent and studio link in Limitless overview |
| Review and branding | Existing review/posts/brand pages and `lib/social-static-graphics.tsx`: own name, sources/manual brief, real-estate graphic signature |
| Own provider connection | `lib/social-realty-instagram*.ts`, `app/api/social/realty/instagram/*`, existing integration page/actions: signed browser/session-bound OAuth and own-account-only credentials |
| Schedule and delivery | `lib/social.ts`, `lib/social-realty-dispatch.ts`, existing social daily/publisher Trigger tasks: explicit intents on shared infrastructure |
| Compatibility | `lib/social-ai.ts`, `lib/social-meta-publisher.ts`: reject old Flux planner in Realty context; match provider token/account families |
| Evidence | Three new behavior suites, existing suite dependency updates, `tests/social-realty/*`, Playwright config and scoped CI workflow |

## Account setup and live acceptance

The owner must supply Limitless Realty's Instagram professional account handle and authorize that exact account. Register `https://fluxknight.space/api/social/realty/instagram/callback` in the existing Instagram provider application's allowed redirects. Provider application credentials may be shared server-side; connected account IDs and access tokens may not.

From Limitless Realty, open Social → Connection status, enter the actual handle and authorize. OAuth verifies the returned handle and rejects Fluxknight's account. Previews deliberately cannot authorize production provider accounts. Stored connection status does not prove current permissions or successful publication.

Before the first public post, review real sources, upload/prepare organization-approved media, inspect the final graphic/caption, approve and explicitly schedule. Live permissions and end-to-end delivery remain unverified until the account owner connects and authorizes a real publication. No public post is authorized merely by enabling this workspace.

## Verification record

Local source suites: 21 Social test files passed, including 34 individual new assertions for generation, OAuth and schedule/publisher safety. Scoped lint: zero errors, two existing warnings (unused legacy `publishingReady`; the OG renderer's intentional image element). A full support regression and final seven-case/six-width browser run are recorded below after completion.

Local Turbopack production builds encounter the execution environment's `binding to a port: Operation not permitted` CSS-worker restriction; this is not reported as a successful build. A webpack build and the hosted Vercel build provide independent verification where available. An initial type check overlapped fixture-generated `.next/dev` declarations; rerun after generation stabilized. Do not infer a production build passed from browser success.

Screenshots are real rendered pages using synthetic accounts/data and blocked external providers, not authenticated production acceptance or approved replacements for existing visual baselines. No before screenshot is fabricated: the before-state workspace exclusion is documented from the original layout source.
