import React from "react";
import { Composition, registerRoot } from "remotion";
import { FluxSocialReel, type FluxSocialReelProps } from "./FluxSocialReel";

const FPS = 30;

const Root = () => (
  <Composition<FluxSocialReelProps>
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
          },
        ],
      },
      logoUrl: "",
      brandName: "Fluxknight",
      website: "Fluxknight.space",
    }}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round(props.plan.scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0) * FPS)),
      props,
    })}
  />
);

registerRoot(Root);
