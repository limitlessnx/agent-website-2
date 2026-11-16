import React from "react";
import { Composition, registerRoot } from "remotion";
import { FluxSocialReel } from "./FluxSocialReel";
import { FluxSocialGraphic } from "./FluxSocialGraphic";
import { FluxknightBrandFilm, brandFilmDuration } from "./FluxknightBrandFilm";

const FPS = 30;

const Root = () => (
  <>
    <Composition
      id="FluxSocialReel"
      component={FluxSocialReel}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={30 * FPS}
      defaultProps={{
        plan: {
          title: "Fluxknight Reel",
          objective: "Product education",
          target_duration_seconds: 30,
          hook: "A better follow-up system starts here.",
          cta: "See how it works",
          scenes: [
            {
              order: 1,
              duration_seconds: 30,
              scene_type: "hook",
              voiceover: "",
              on_screen_text: "A better follow-up system starts here.",
              visual_direction: "Fluxknight UI and motion graphics.",
              source_media: "motion_graphics",
              visual: { kind: "pipeline", title: "A clear next step", items: ["Customer enquiry", "Assigned owner", "Follow-up"] },
            },
          ],
        },
        logoUrl: "",
        brandName: "Fluxknight",
        website: "Fluxknight.space",
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(
          1,
          Math.round(
            props.plan.scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0) * FPS,
          ),
        ),
        props,
      })}
    />
    <Composition
      id="FluxknightBrandFilm"
      component={FluxknightBrandFilm}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={90 * FPS}
      defaultProps={{
        scenes: [
          { id: "first-inquiry", title: "Every relationship starts somewhere", description: "Discovery and first contact", durationSeconds: 10, mediaKind: "customer" as const },
          { id: "maia", title: "Meet Maia", description: "Immediate assistance and qualification", durationSeconds: 12, mediaKind: "customer" as const },
          { id: "crm", title: "Every conversation has context", description: "Capture interests and next steps", durationSeconds: 12, mediaKind: "customer" as const },
          { id: "nurture", title: "Stay connected", description: "Thoughtful follow-ups before a purchase", durationSeconds: 11, mediaKind: "customer" as const },
          { id: "conversion", title: "Turn interest into action", description: "Inspections, bookings and sales handovers", durationSeconds: 12, mediaKind: "customer" as const },
          { id: "retention", title: "Relationships continue", description: "Support after the first transaction", durationSeconds: 10, mediaKind: "customer" as const },
          { id: "return", title: "Create reasons to return", description: "Re-engagement and repeat business", durationSeconds: 12, mediaKind: "customer" as const },
          { id: "outro", title: "Fluxknight", description: "Automate for speed, scale without boundaries.", durationSeconds: 6.92, mediaKind: "brand" as const },
        ],
        logoUrl: "",
        musicUrl: null,
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, brandFilmDuration(props.scenes, FPS)),
        props,
      })}
    />
    <Composition
      id="FluxSocialGraphic"
      component={FluxSocialGraphic}
      width={1080}
      height={1350}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{
        kind: "static",
        logoUrl: "",
        pillar: "Business automation",
        headline: "Build a smarter operating system.",
        body: "",
        footer: "Smarter operations with Fluxknight.",
        slideType: "insight",
        index: 1,
        total: 1,
      }}
    />
  </>
);

registerRoot(Root);
