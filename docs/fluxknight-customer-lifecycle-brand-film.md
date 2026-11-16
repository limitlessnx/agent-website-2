# Fluxknight Customer Lifecycle Brand Film — Production Manifest

This is the approved **85.92-second master narration** timeline for the 16:9 brand film. This is a production brief, **not footage**. No dummy video may be shipped as a real dashboard demonstration.

## Approved source
- Voice: ElevenLabs, single continuous take, duration 85.92 seconds.
- Source flow: https://elevenlabs.io/app/flows/UqUhG4BbUlSY2SwpAWG7
- Use the narration as `voiceoverUrl` in an untracked manifest; do not store signed links in Git.
- Canonical Fluxknight primary logo: fetch from the active `social_brand_assets` registration, restricted to Fluxknight organization.
- Website: https://fluxknight.space
- Tagline: Automate for speed, scale without boundaries.
- Audio: continuous voiceover with gentle background bed only if licensed.
- Never auto-publish: review the final MP4 before publication.

## Scenes

| Segment | Duration | Required footage / visuals |
|---|---:|---|
| Inquiry | 10s | Realistic Nigerian property prospect sees an estate listing and sends a message |
| Maia | 12s | Realistic customer phone scene alongside **genuine** Maia conversation capture |
| Capture | 12s | Actual Fluxknight CRM contact details (use synthetic/sanitized test data only) |
| Nurturing | 11s | Prospective buyer receives relevant follow-up; true dashboard workflow |
| Conversion | 12s | On-site property inspection and human sales handover |
| Retention | 10s | Buyer receives legitimate post-sale information or support |
| Re-engagement | 12s | Same buyer returns after seeing a relevant permitted offer; repeat opportunity |
| Closing | 6.92s | Canonical logo, connected lifecycle animation, tagline and website |

**Total: 85.92 seconds.** Align shot cuts to narration during editorial review. Narration must not be slowed down simply to stretch the film.

## Export specification
- 1920×1080, 30fps, H.264 MP4
- Film composition ID: `FluxknightBrandFilm`
- Source: approved media URLs, official logo, one uninterrupted narration track
- Output validated for positive duration, audio track and file size
- Render command: `node scripts/render-fluxknight-brand-film.mjs ./local-untracked-manifest.json ./fluxknight-brand-film.mp4`

## Approval blockers
- Realistic customer footage has not been supplied or selected.
- Actual Maia and CRM screen captures have not been supplied.
- Approved logo is registered in Supabase but must be inserted as an authorized signed file URL.
- ElevenLabs completed narration is in a separate connected workspace, not yet available to the renderer as a stored media file.
- No full end-to-end MP4 has passed render + visual QA.
