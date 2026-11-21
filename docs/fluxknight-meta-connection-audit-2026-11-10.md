# Fluxknight Meta connection audit — 2026-11-10

## Baseline and code scope

Started from current main `ad67d9a5440451cc6712a3e081718686602e43e2`, which includes merged voiceover PR #361. The older hotel checkout was left untouched. PR #362 changes only Meta connection code, its controls, tests, CI and this audit. No Maia, hotel, Trigger task, package, schema or schedule definitions change.

## Production findings and repairs

- Parent Meta app: **FLUXKNIGHT**, ID `1624965062683468`. Instagram Login product: **FLUXKNIGHT-IG**, ID `1629175728667135`. Both IDs match the credentials configured in Fluxknight. Secrets remained hidden.
- Facebook Page **Fluxknight Systems**, ID `581576128370387`, is linked to Instagram account ID `17841443218064774`. The stored username was stale: the live account is now **@fluxknight.space**, previously stored as @flux_knight. Confirmed the same ID in Meta's account picker and the active Instagram profile, then corrected only `configuration.instagram_username` in the production integration record.
- The existing Instagram OAuth tab showed **Insufficient Developer Role**. The app is unpublished and initially had no Instagram testers. With explicit user approval, added @fluxknight.space as an Instagram Tester and accepted the FLUXKNIGHT-IG invitation, including its displayed Platform Terms and Developer Policies. Instagram visibly confirmed authorization.
- The Facebook Business Login configuration `1045071945197499` contained 16 permissions but omitted `pages_manage_posts` and `instagram_content_publish`. With explicit user approval, added those two and verified the saved list has all 18. The other 16 were preserved.
- Facebook Client OAuth and Web OAuth are enabled, HTTPS and strict redirect matching are enforced, and the production callback is registered.
- The Instagram product allowed both its OAuth callback and its webhook as OAuth redirects. Its generated embed URL incorrectly chose the webhook. Removed the webhook entry from the OAuth allowlist and verified the generated login URL now uses the correct callback. The actual webhook configuration was left intact.
- The Instagram webhook URL is configured correctly. Deauthorization and data-deletion request URLs are blank in Instagram Business Login settings; those remain app-review configuration requirements before broader public use.

**Direct Instagram reauthorization succeeded.** With explicit user approval, completed Instagram consent for @fluxknight.space. The production callback exchanged the token, read the account profile and stored it in Vault. Verified actual recorded grants `instagram_business_basic` and `instagram_business_content_publish`, direct Instagram-scoped ID `29288597700776232`, and expiry **2027-01-09T13:35:58.099Z**. This ID is distinct from the Facebook-linked account ID, so token-family/ID pairing matters. Recorded the verified callback time as the token issue time for the new renewal control. No token value was exposed. The production UI shows Instagram publishing ready.

**Facebook refresh is paused at final consent.** User approved preserving all existing asset access and the publishing additions. Meta's review also requires accepting Meta Business Tools and Product Catalog Terms; that final legal acceptance remains pending. No replacement Facebook token has been stored yet. Existing business, Instagram and WhatsApp asset selections were preserved in the prepared consent flow. Historical connected/healthy labels alone do not prove Facebook publishing capability until that flow completes.

## Exact production URLs

- Facebook OAuth: `https://fluxknight.space/api/integrations/meta/callback`
- Instagram OAuth: `https://fluxknight.space/api/integrations/meta/instagram/callback`
- Instagram webhook: `https://fluxknight.space/api/integrations/meta/instagram/webhook`

The webhook is not an OAuth authorization-code receiver. The parent Facebook and Instagram product settings are separate allowlists. Production OAuth starts on the canonical host so host-only browser state cookies reach the callback.

## Code fixes in PR #362

- Accept both documented `data[0]` and historical flat Instagram token exchange responses. Use unversioned long-token exchange/renewal endpoints and require a valid long-lived token with expiry. Do not infer granted permissions from requested scopes.
- Bind Instagram OAuth to the initiating browser's HTTP-only SameSite cookie and require an admin session on callback. Remove the predictable state-signing secret fallback.
- Enumerate paginated Facebook Pages, require an unambiguous target, validate Page and Instagram preferences together, and reject missing Page tokens instead of substituting a user token.
- Pair direct Instagram IDs/tokens with the Instagram Graph host, and Facebook-linked Instagram IDs/Page tokens with the Facebook Graph host. Direct Instagram no longer requires Facebook credentials. Check per-platform recorded grants, intended account and token expiry.
- Distinguish configured, linked and publishing-authorized states. Settings-only saves no longer claim successful OAuth or health checks. Ordinary anchors prevent connection links from being prefetched.
- Add an explicit admin connection check that only reads provider identity/permissions and an explicit Instagram renewal control. No new cron or automatic renewal schedule is introduced.
- Authenticate webhook POST bodies with `X-Hub-Signature-256`. This endpoint acknowledges authenticated notifications; it does not publish or implement messaging automation.
- Vault credential RPCs remain server-only and restricted to service_role. No secret values are rendered to the client.

Long-lived Instagram tokens can be renewed only while valid and at least 24 hours old. Expired/revoked tokens require OAuth again. Facebook user/Page tokens are a different token family and must not be sent to the Instagram refresh endpoint.

## Trigger.dev deployment and voiceover runtime

Recovered Chrome access and verified production deployment **20261110.2**, commit **ad67d9a5440451cc6712a3e081718686602e43e2**, Node **24.22.1**, with **24 tasks**. The Reel renderer is present; Maia and the four existing scheduled reminder tasks remain present. No deployment or schedule was changed.

Verified these names in Trigger.dev **Production**, with all values kept hidden:

- `ELEVENLABS_API_KEY` (stored as a secret)
- `ELEVENLABS_FLUX_SOCIAL_PREMIUM_MALE_VOICE_ID`
- `ELEVENLABS_SOCIAL_MODEL`

A real private voice-only render was attempted through `flux-social-render-reel`, using a separate probe draft copied from an existing storyboard. The original approved Reel was not regenerated. Probe `79ae5123-4731-4d00-aa5f-3988286763d1` has **no publishing platforms and zero schedules**. The run used one maximum attempt and an idempotency key.

**Result: failed at scene 1 with ElevenLabs HTTP 402.** This confirms the deployed task reaches the narration provider, but successful audio generation, private MP3 upload and combined MP4 rendering remain blocked. ElevenLabs documents HTTP 402 as payment/insufficient-credit related. The raw provider body was not exposed, so the exact workspace balance or key-level allowance was not established. No billing, subscription, API key, or spending configuration was changed.

[Private test run](https://cloud.trigger.dev/orgs/fluxknight-6833/projects/fluxknight-k7ol/env/prod/runs/run_06gsb8pngt38cl08jfgvni31a2)

The failed probe remains in review with no approval; no content was posted. No licensed audio asset exists for this brand, so full narration-plus-music release verification also needs a rights-cleared soundtrack. The source intentionally permits a voice-only private preview while blocking publication approval without licensed music.

## Remaining release checks

1. Complete the final Facebook terms acceptance and token refresh, then verify the stored Facebook grants and intended Page/Instagram identity without posting. Direct Instagram consent is already complete.
2. Review/merge PR #362 separately; no merge has been performed.
3. Resolve the ElevenLabs 402 for the actual project key, then rerun the same private probe once using a new run/idempotency key. Confirm private audio storage, synchronized MP4 audio/duration and listening playback.
4. Select a licensed soundtrack and obtain human narration/content approval before any scheduling or publishing test.
5. Preserve the complete current task inventory and live schedule bindings in any later Trigger deployment. Deploying a reduced task directory can remove scheduled tasks from the current deployment.

## Validation

- All **16 focused runtime/OAuth/voiceover tests** passed locally.
- TypeScript `--noEmit`, scoped ESLint and `git diff --check` passed.
- GitHub **Meta connection verification**, **Dashboard Final QA**, **Maia Draft Verification** passed; **Vercel preview succeeded** on code commit `71ac93d53efbdd4b5c624159564282d977a48cc4`.
- The local Windows schedule-allowlist assertion differs only in slash direction. The corresponding Ubuntu CI check passed; no schedule source file changes.
- Uploaded code tree matched the locally tested tree exactly: `129ab759637e22c87538f0f36ddec4f0d133c0c4`. Subsequent audit-only edits do not change that tested implementation.

## References

- [Meta Instagram Business Login, token response and renewal](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login)
- [Meta permission reference](https://developers.facebook.com/documentation/development/permissions)
- [Trigger.dev scheduled task deployment behavior](https://trigger.dev/docs/tasks/scheduled)
- [ElevenLabs TTS status-code troubleshooting](https://elevenlabs.io/blog/how-to-integrate-text-to-speech)
