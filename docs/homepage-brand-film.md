# Fluxknight homepage brand film

The isolated homepage section is inserted immediately after `ProductLedHero` and before `AutomationJourney`, without altering either existing component.

## Publishing the approved master film

The MP4 is **not committed** to Git. Upload the approved film to a publicly streamable HTTPS video storage service (for example a managed media CDN or Vercel Blob public store). Ensure the host supports MP4 byte-range requests and responds with `video/mp4`.

In Vercel, set both preview and production environment variables:

- `NEXT_PUBLIC_FLUXKNIGHT_BRAND_FILM_URL=https://<your-public-cdn>/<approved-video>.mp4`
- `NEXT_PUBLIC_FLUXKNIGHT_BRAND_FILM_CAPTIONS_URL=https://<your-public-cdn>/<verified-en-captions>.vtt` (recommended; only configure after syncing captions with actual audio)

Redeploy after configuring these build-time public variables. The section intentionally renders nothing until a valid HTTPS video URL is configured, preventing broken playback in production. The player uses the existing `/opengraph-image` endpoint as a lightweight poster.

## QA before merge

1. Mobile, tablet and desktop: responsive headline and player with no text overlaps or horizontal overflow.
2. Play on explicit click, confirm audible narration, seeking, keyboard controls, and fullscreen.
3. Captions match the approved 89-second narration and can be enabled.
4. On a slow connection, the homepage hero remains interactive: video bytes are deferred using `preload="none"`.
5. The remote video supports range requests and is served with the correct content type.
6. Run `node --test tests/homepage-brand-film.test.cjs`, typecheck, and the production build; inspect Vercel preview before merge.

## Guardrails

- No autoplay or player dependency.
- Do not change hero, industry sections, Maia, Leo, trial/onboarding, tenant APIs or backend workflows.
- Keep the PR in draft until the actual video URL and captions are provided and the preview is visually verified.
