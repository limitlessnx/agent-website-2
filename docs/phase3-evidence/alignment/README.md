# 12ui improve kit

Input: image `/workspace/flux-next-phase/docs/phase3-evidence/after/platform-settings-1440.png`
Picked candidate: bring-your-own target

## Status

- capture: settled
- draft: skipped — a target was supplied
- pick: skipped — a target was supplied
- convert: settled
- plan: settled
- Target: LayerDoc only

Every requested stage settled. The kit is complete.

## Start here

Bounds are % of the capture frame (1440×3566); `winner.png` is the design at its own size (1536×1024); place by percentage, not by pixel.

1. Open `source.png`. It is the design.
2. Copy the files the assets table below marks ship into the repository; the rest are references and alternates.
3. Apply `plan/token-patch.css` once, at the token layer, not per element.
4. Work `plan/plan-annotated.md` in its own order: raster layers, then matched changes, then added elements.
5. Before committing, screenshot the page and put it beside `source.png`.

## Assets: what each file is

- clean plate (`clean-N`): the backdrop with the foreground artwork removed. Use it as the background layer, at full strength.
- cutout (`cutout-N`): the foreground artwork as an alpha PNG. This is the imagery. Copy it into the repo and place it at its bounds; never redraw it in CSS.
- upscaled plate (`upscaled-plate-N`): a higher-resolution copy of a plate for crisp rendering; pick one resolution, do not ship both.
- upscaled region (`upscaled-region-N`): a higher-resolution copy of a region for crisp rendering; pick one resolution, do not ship both.
- source crop (`crop-N`): the layer cropped straight out of the source image. Prefer that layer's cutout when one exists.
- `source.png`: the whole design; the reference for every visual decision.
- Icons (`plan/assets/added-*.svg`): reference `<name>.svg` — it carries the design's declared colour and is safe as an `<img>`, `background-image`, or `url()`; its `<name>-inline.svg` sibling paints with `currentColor` and is for inlining in the markup or masking with a token colour.

Ordered by how much of the canvas the layer covers.

Ship means copy this file into the repository. An alternate resolution is the same layer at another size — pick one. An alternate backdrop is the same plate with a further layer removed as well — it is the background only if you omit that layer. A reference is read, never shipped.

Plates and cutouts come out at full resolution and run over a megabyte. Pick one resolution per layer and optimise the PNG — or convert it to WebP where the repository already uses one — before committing. Keep the filename stem so the plan still matches.

| File | Ship | Role | Layer | Bounds | What to do with it |
| --- | --- | --- | --- | --- | --- |
| `source.png` | reference only | winner.png — hero imagery | whole design | 100.0% × 100.0% at 0.0%, 0.0% | the whole design; the reference for every visual decision. |
| `target/winner.layerdoc.json.assets/cutout-3-67bd0a9df9a1.png` | ship | cutout | logo — Fluxknight lightning wordmark | 7.4% × 2.4% at 1.4%, 1.5% | the foreground artwork as an alpha PNG. This is the imagery. Copy it into the repo and place it at its bounds; never redraw it in CSS. |
| `target/winner.layerdoc.json.assets/upscaled-region-3-b02be026b652.png` | alternate resolution | upscaled region | logo — Fluxknight lightning wordmark | 7.4% × 2.4% at 1.4%, 1.5% | a higher-resolution copy of a region for crisp rendering; pick one resolution, do not ship both. |
| `target/winner.layerdoc.json.assets/cutout-5-68cddca1d8dd.png` | ship | cutout | icon — Workspace bag in purple rounded square | 1.8% × 3.0% at 1.6%, 7.0% | the foreground artwork as an alpha PNG. This is the imagery. Copy it into the repo and place it at its bounds; never redraw it in CSS. |
| `target/winner.layerdoc.json.assets/upscaled-region-5-04a036095cf3.png` | alternate resolution | upscaled region | icon — Workspace bag in purple rounded square | 1.8% × 3.0% at 1.6%, 7.0% | a higher-resolution copy of a region for crisp rendering; pick one resolution, do not ship both. |
| `target/winner.layerdoc.json.assets/cutout-30-485c4c01446b.png` | ship | cutout | icon — User in blue rounded square | 1.8% × 2.9% at 1.6%, 83.2% | the foreground artwork as an alpha PNG. This is the imagery. Copy it into the repo and place it at its bounds; never redraw it in CSS. |
| `target/winner.layerdoc.json.assets/upscaled-region-30-a34216f8c3ab.png` | alternate resolution | upscaled region | icon — User in blue rounded square | 1.8% × 2.9% at 1.6%, 83.2% | a higher-resolution copy of a region for crisp rendering; pick one resolution, do not ship both. |
| `target/winner.layerdoc.json.assets/crop-55-4bc0f5b27e8e.png` | ship | source crop | icon — table cells | 3.0% × 1.3% at 39.7%, 17.5% | the layer cropped straight out of the source image. Prefer that layer's cutout when one exists. |
| `target/winner.layerdoc.json.assets/cutout-40-7ee838d6cc38.png` | ship | cutout | icon — Purple running figure with green notification dot | 1.1% × 1.7% at 89.5%, 1.7% | the foreground artwork as an alpha PNG. This is the imagery. Copy it into the repo and place it at its bounds; never redraw it in CSS. |
| `target/winner.layerdoc.json.assets/upscaled-region-40-00452047f598.png` | alternate resolution | upscaled region | icon — Purple running figure with green notification dot | 1.1% × 1.7% at 89.5%, 1.7% | a higher-resolution copy of a region for crisp rendering; pick one resolution, do not ship both. |
| `target/winner.layerdoc.json.assets/cutout-42-831cf9f8bbc4.png` | ship | cutout | icon — Green live pulse mark | 0.8% × 0.8% at 92.1%, 2.3% | the foreground artwork as an alpha PNG. This is the imagery. Copy it into the repo and place it at its bounds; never redraw it in CSS. |
| `target/winner.layerdoc.json.assets/upscaled-region-42-8f9ef80ceca1.png` | alternate resolution | upscaled region | icon — Green live pulse mark | 0.8% × 0.8% at 92.1%, 2.3% | a higher-resolution copy of a region for crisp rendering; pick one resolution, do not ship both. |
| `target/winner.layerdoc.json.assets/source-2501d6aea0cd.png` | reference only | prepared source | whole design | full canvas | the normalized image the conversion read; the same picture as `winner.png`. |
| `target/winner.layerdoc.json.assets/upscaled-region-55-f74872b661c4.png` | alternate resolution | upscaled region | whole design | full canvas | a higher-resolution copy of a region for crisp rendering; pick one resolution, do not ship both. |

### Never discard

- `source.png`.
- Every cutout and plate this table names.
- All real content, data, controls, routes, and tests.

Scrims over a plate stay light (at most 35% opacity), and the plan must say why one is used.

## Guardrails

- Preserve all real content, data, and controls. Do not fabricate product features or copy.
- Do not describe emptiness or thin content as a defect: that phrasing can invite fabricated UI.
- Verify Tailwind v4 arbitrary custom-property syntax, quote CSS `url(...)` values, and update CSP before introducing data URIs.
- Never use the raw candidate PNG as a shipped asset; ship the extracted cutouts and plates.
- Never scrim imagery away. A heavy overlay is a fidelity defect, not a readability fix.
- Do not add decoration the design does not contain.

## Spend ledger

Nothing was purchased against this kit.

## Anatomy

- `improve.json` is the durable stage, purchase, price-ceiling, and replay record.
- `source.png` is the normalized source screenshot.
- `candidates/` keeps every generated option and its draft record; `winner.png` is the explicit image target.
- `target/` holds the target LayerDoc, responsive HTML when generated, and extracted assets.
- `plan/` holds the diff, implementation plan, token patch, added-element assets, `GATE.md` when anchoring was unsafe, or `STALL.md` when a stage did not settle.

## Replay

- Apply the plan in the owning repository, then verify behavior and screenshots there. This kit never applies code.
- The target HTML is a visual implementation reference. A passed selector gate proves anchor coverage, not factual content preservation or working filters, navigation, and application integrations. Keep the source application authoritative for those when applying the design.
- Re-run from `pick` with another `--pick` slot to reuse capture and candidates; settled paid stages replay.
