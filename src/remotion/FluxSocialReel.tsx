import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ReelPlan } from "@/lib/social-video-plan";
import { getReelVisual, normalizeReelText } from "./reel-visual-model";
import { ReelIllustration } from "./ReelIllustration";

export type FluxSocialReelProps = {
  plan: ReelPlan;
  logoUrl: string;
  brandName: string;
  website?: string;
  narrationClips?: Array<{ sceneIndex: number; signedUrl: string; durationSeconds: number }>;
  musicUrl?: string | null;
  captionsEnabled?: boolean;
};

function SceneCard({ text, accent }: { text: string; accent?: boolean }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(frame, [0, 12], [36, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ opacity, transform: `translateY(${translateY}px)`, fontSize: accent ? 70 : 58, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.035em", color: "white", maxWidth: 870, whiteSpace: "pre-line" }}>
      {normalizeReelText(text)}
    </div>
  );
}

function ReelScene({ plan, sceneIndex, captionsEnabled }: { plan: ReelPlan; sceneIndex: number; captionsEnabled: boolean }) {
  const scene = plan.scenes[sceneIndex];
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 30, 60], [0.18, 0.42, 0.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#050507", color: "white", padding: "240px 70px 120px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)", backgroundSize: "52px 52px" }} />
      <div style={{ position: "absolute", width: 720, height: 720, borderRadius: 999, right: -220, top: -180, background: `radial-gradient(circle, rgba(139,92,246,${glow}) 0%, rgba(139,92,246,0) 68%)` }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", gap: 64 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 22, color: "#c4b5fd", letterSpacing: "0.18em", textTransform: "uppercase" }}>{scene.scene_type.replaceAll("_", " ")}</div>
          <SceneCard text={scene.on_screen_text} accent={scene.scene_type === "hook"} />
          {captionsEnabled && scene.voiceover ? <div style={{ fontSize: 28, color: "#d4d4d8", lineHeight: 1.45, maxWidth: 820 }}>{normalizeReelText(scene.voiceover)}</div> : null}
        </div>
        <ReelIllustration visual={getReelVisual(scene)} />
      </div>
    </AbsoluteFill>
  );
}

export const FluxSocialReel: React.FC<FluxSocialReelProps> = ({ plan, logoUrl, brandName, website = "Fluxknight.space", narrationClips = [], musicUrl = null, captionsEnabled = false }) => {
  const { fps } = useVideoConfig();
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#050507", fontFamily: "Arial, Helvetica, sans-serif" }}>
      {plan.scenes.map((scene, index) => {
        const durationInFrames = Math.max(1, Math.round(scene.duration_seconds * fps));
        const from = cursor;
        cursor += durationInFrames;
        return (
          <Sequence key={`${scene.order}-${index}`} from={from} durationInFrames={durationInFrames}>
            <ReelScene plan={plan} sceneIndex={index} captionsEnabled={captionsEnabled} />
            {narrationClips.find((clip) => clip.sceneIndex === index) ? (
              <Audio
                src={narrationClips.find((clip) => clip.sceneIndex === index)!.signedUrl}
                volume={1}
              />
            ) : null}
          </Sequence>
        );
      })}
      {musicUrl ? <Audio src={musicUrl} loop volume={0.12} /> : null}
      <div style={{ position: "absolute", top: 52, left: 52, right: 52, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
        {/* Canonical logo asset only. Never redraw the logo in Remotion. */}
        <div style={{ width: 210, height: 148, display: "flex", alignItems: "center", justifyContent: "flex-start" }}><Img src={logoUrl} alt={`${brandName} logo`} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "left center" }} /></div>
        <div style={{ color: "#e4e4e7", fontSize: 18, letterSpacing: "0.12em" }}>{brandName.toUpperCase()}</div>
      </div>
      <div style={{ position: "absolute", bottom: 38, left: 52, right: 52, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10, fontSize: 18, color: "#a78bfa" }}>
        <span>{website}</span>
        <span style={{ maxWidth: 640, textAlign: "right", lineHeight: 1.4 }}>{normalizeReelText(plan.cta)}</span>
      </div>
    </AbsoluteFill>
  );
};
