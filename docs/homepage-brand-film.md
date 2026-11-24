# Fluxknight homepage brand film (YouTube)

The standalone video section sits immediately after `ProductLedHero` and before `AutomationJourney`. No other homepage components or workflows are modified.

## Publish using YouTube

1. Upload the approved narrated 89-second brand film to the official Fluxknight YouTube account at https://studio.youtube.com/.
2. Choose **Unlisted** (recommended until approved), or **Public** for discoverability. Do not choose **Private**, which prevents ordinary website visitors from watching.
3. Allow embedding in the YouTube video's settings. Check copyright and audio restrictions before publishing.
4. Add/review the English captions in YouTube Studio and set a custom thumbnail.
5. Current approved official film: https://youtu.be/JvxHWD_C_7s (public, 1:29). This is the component's default video ID.
6. No environment variable is required for this specific approved video. For future film replacements, set `NEXT_PUBLIC_FLUXKNIGHT_BRAND_FILM_YOUTUBE_URL` in Vercel and redeploy; the component otherwise uses the approved default ID.
7. Inspect the preview on desktop, tablet, and mobile; ensure the video plays with audio, captions work, fullscreen functions, and the fallback 'Watch on YouTube' link opens the right video.
8. After testing, merge the PR and validate the production homepage.

The YouTube iframe uses `youtube-nocookie.com`, is only mounted when visitors choose to play, and avoids auto-loading the remote player. Playback begins from that click; browser privacy or autoplay settings may still affect automatic start. Playback, CC and fullscreen are provided by YouTube.

## QA checklist

- Video posted on the official Fluxknight YouTube channel with appropriate visibility and embed permissions.
- Video ID matches approved asset; complete 89-second narration and visuals verified in YouTube playback.
- Preview and production builds complete without TypeScript errors.
- Homepage hero, existing CTAs, industries, Maia, Leo, onboarding and backend routes unchanged.
- Responsive layout passes 360px, 768px, and desktop widths without text overlap or horizontal scrolling.
- Optional analytics and watch metrics can be reviewed in YouTube Studio.

## Tests

Run `node --test tests/homepage-brand-film.test.cjs` and `npm run build`. The YouTube film is published; confirm rendered section, click-to-play and full playback in the Vercel preview before merging.
