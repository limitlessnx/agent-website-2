# Fluxknight Meta connection audit — 2026-11-10

## Baseline and verified production evidence

Started from main `ad67d9a5440451cc6712a3e081718686602e43e2`, which includes merged PR #361 (the current-main integration of #355). The older hotel checkout was left untouched.

Read-only production database inspection found:

- Meta app ID `1624965062683468`; Chrome's existing developer dashboard identifies it as **FLUXKNIGHT**.
- Facebook Page **Fluxknight Systems**, ID `581576128370387`, linked to Instagram professional account **@flux_knight**, ID `17841443218064774`.
- Separate Instagram Login app ID `1629175728667135`; its secret and webhook verify token are configured, but **no direct Instagram user token is stored**.
- Facebook authorization has `pages_show_list`, `pages_read_engagement`, and `instagram_basic`, but lacks **`pages_manage_posts` and `instagram_content_publish`**. The record's connected/healthy status was last checked September 26 and did not establish publishing readiness.
- Existing Chrome Instagram OAuth tab displays **“Insufficient Developer Role”**. This blocks authorization before the callback; a code patch alone cannot grant app roles.

No token or secret values were printed. No production database, schedule, Meta configuration, or publishing setting was changed during this audit.

## Code fixes

- Handle both documented `data[0]` and historical flat Instagram token exchange responses. Use the unversioned long-token exchange and renewal endpoints. Require a valid long-lived token and expiry; never substitute requested scopes for actual grants.
- Bind Instagram OAuth to the initiating browser's HTTP-only, SameSite cookie and require an admin session on callback. Remove the predictable state-signing secret fallback. Use production host-only cookies and redirect to the canonical host before starting OAuth.
- Enumerate paginated Facebook Pages, require an unambiguous target, validate both Page and linked Instagram preferences, and reject missing Page tokens rather than substituting a user token.
- Pair direct Instagram IDs with direct tokens and the Instagram Graph host; pair Facebook-linked IDs with Page tokens and the Facebook Graph host. Direct Instagram publishing no longer requires Facebook credentials. Check per-platform recorded grants and token expiry.
- Distinguish configured, linked, and publishing-authorized states. Saving app settings no longer marks a fresh app-only integration healthy/connected. OAuth navigation uses ordinary anchors so prefetch cannot create an authorization state.
- Add an explicit admin connection check that only reads provider identity/permissions, and explicit Instagram token renewal. No new cron or automatic renewal schedule is introduced.
- Authenticate webhook POST bodies with `X-Hub-Signature-256` before accepting notifications. This webhook is an authenticated acknowledgement endpoint; it does not implement messaging automation or publishing.

## Required Meta dashboard verification

For app **FLUXKNIGHT**, confirm the IDs above refer to the intended app/products. The display name is not an OAuth credential.

1. Facebook Login / Facebook Login for Business must allow exactly:
   `https://fluxknight.space/api/integrations/meta/callback`
2. Instagram product → API setup with Instagram Login → Business login settings must allow exactly:
   `https://fluxknight.space/api/integrations/meta/instagram/callback`
   Use the Instagram product's App ID and secret, not an assumed copy of the parent Meta app credentials. Avoid trailing-slash mismatches.
3. Confirm HTTPS, App Domain `fluxknight.space`, website URL, privacy policy, and data-deletion instructions are correct in the app dashboard. A Vercel preview is not the production OAuth callback host.
4. The saved Facebook Business Login configuration ID is `1045071945197499`. When `config_id` is used, Meta controls its permissions/assets in that configuration. Add/approve the required publishing grants there; the code's classic `scope` list does not override that configuration.
5. Facebook path: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`; Instagram through Facebook additionally needs `instagram_basic` and `instagram_content_publish`. Confirm Page management/content-creation access and that the intended professional Instagram account is linked to that Page.
6. Direct Instagram path: request `instagram_business_basic` and `instagram_business_content_publish`. A Facebook Page is not required for this path. For development/Standard Access, add the intended professional account under the app's Instagram tester/role settings and accept the invitation in Instagram. Verify the account performing consent is the invited account. Accounts outside owned/managed test assets require the applicable Live mode, app review/Advanced Access and business verification required by Meta.
7. Webhook URL: `https://fluxknight.space/api/integrations/meta/instagram/webhook`. Configure the matching private verify token and correct signing app secret. GET challenge verification and signed POST delivery must both be tested. No messaging scopes are requested by this publishing-only flow.
8. Reconnect the intended accounts and run **Check connection (no publishing)**. A successful OAuth redirect alone is not proof of publishing permission. Inspect per-platform authorization and token expiry in the UI.

Long-lived Instagram tokens can be renewed only while valid and at least 24 hours old. The new manual renewal control extends a valid token; expired/revoked tokens need OAuth again. Facebook's long-lived user/Page tokens are a different token family: do not send them to the Instagram refresh endpoint. Use reconnection and the GET-only identity/permission check for revocation/access changes.

## Trigger.dev Reel and voiceover readiness

User confirms the voiceover environment variables have been added. Source on main includes task `flux-social-render-reel` and private ElevenLabs narration, licensed music selection, audio/duration verification, and human narration approval. Project config targets `proj_ckweruqrgwndssqpjdvg`, Node 24, Remotion 4.0.523, copied Remotion sources and Linux Chromium/font dependencies. Required runtime variables include `ELEVENLABS_API_KEY`, `ELEVENLABS_FLUX_SOCIAL_PREMIUM_MALE_VOICE_ID`, optional `ELEVENLABS_SOCIAL_MODEL`, and the existing Supabase service credentials; source presence does not prove production has the current task build.

The production Trigger dashboard was visible in Chrome inventory at `https://cloud.trigger.dev/orgs/fluxknight-6833/projects/fluxknight-k7ol/env/prod`, but browser tab reads repeatedly timed out, including after the user reconnected Chrome. Therefore the deployed task version, production variable presence, provider authentication, private uploads, actual rendered MP4, and narration playback remain **unverified**. No deployment or task was started.

Before a production deploy, compare the current deployment's task inventory with the proposed artifact so all Maia/reminder tasks and live schedule bindings are retained. Deploying only a reduced task directory can remove scheduled tasks from the current deployment. Do not change schedule definitions or activate automation as part of the connection repair.

End-to-end completion requires an explicitly selected, unscheduled review/draft Reel with a licensed soundtrack: render privately, listen to narration, inspect the combined MP4, and leave publishing approval to the user. Do not run the publisher, create a Meta media container, or post a test Reel without separate explicit consent.

## References

- [Meta Instagram Business Login, token response and renewal](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login)
- [Meta permissions reference](https://developers.facebook.com/documentation/development/permissions)
- [Trigger.dev scheduled task deployment behavior](https://trigger.dev/docs/tasks/scheduled)

## Validation

Behavioral tests cover both Instagram response formats, missing grants, expired/missing direct tokens, Page targeting ambiguity/mismatch, wrong token-family/ID pairing, webhook forgery, and GET-only secret-free connection checks. Voiceover approval contracts and Meta OAuth URL contracts are included. Local Windows schedule-allowlist test has a pre-existing slash-normalization failure: the actual four scheduled task filenames match the expected four names, with backslashes instead of forward slashes. No schedule source files are changed.
