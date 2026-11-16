import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/** Editorial film: never invent product screenshots. Supply approved, real media URLs. */
export type BrandFilmScene = {
  id: string;
  title: string;
  description?: string;
  durationSeconds: number;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  mediaKind?: "customer" | "actual-product" | "brand";
  narrationUrl?: string;
};
export type FluxknightBrandFilmProps = {
  scenes: BrandFilmScene[];
  logoUrl: string;
  musicUrl?: string | null;
  website?: string;
  tagline?: string;
};
export const brandFilmDuration = (scenes: BrandFilmScene[], fps = 30) =>
  scenes.reduce((total, scene) => total + Math.max(1, Math.ceil(scene.durationSeconds * fps)), 0);

export function validateBrandFilm(props: FluxknightBrandFilmProps) {
  if (!props.logoUrl || !/^https:\/\//.test(props.logoUrl)) throw new Error("Approved canonical HTTPS logo required.");
  if (!props.scenes.length) throw new Error("Brand film requires scenes.");
  if (props.scenes.some(s => !s.id || !s.title || !Number.isFinite(s.durationSeconds) || s.durationSeconds <= 0))
    throw new Error("Brand film scenes must have a title, ID and positive duration.");
  if (new Set(props.scenes.map(s => s.id)).size !== props.scenes.length) throw new Error("Scene IDs must be unique.");
  for (const scene of props.scenes) {
    if (scene.mediaKind === "actual-product" && (!scene.mediaUrl || !scene.mediaType))
      throw new Error("Real product scenes must use authenticated product footage, not illustrative replacements.");
    if (scene.mediaUrl && !/^https:\/\//.test(scene.mediaUrl))
      throw new Error("All footage and dashboard assets must use signed HTTPS URLs.");
    if (scene.narrationUrl && !/^https:\/\//.test(scene.narrationUrl))
      throw new Error("Narration must use an HTTPS URL.");
  }
}
const purple = "#A78BFA";
const backdrop: React.CSSProperties = { background: "radial-gradient(circle at 78% 30%, #392060, #0A0712 62%)", color: "#FAF8FF", fontFamily: "Arial, Helvetica, sans-serif" };

function FilmShot({ scene }: { scene: BrandFilmScene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, Math.round(fps * 0.22)], [0, 1], { extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [0, Math.max(1, Math.round(scene.durationSeconds * fps))], [1, 1.035], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={backdrop}>
    {scene.mediaUrl ? <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
      {scene.mediaType === "video" ? <OffthreadVideo src={scene.mediaUrl} muted /> : <Img src={scene.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </AbsoluteFill> : <AbsoluteFill style={{ background: "radial-gradient(circle at 70% 40%, #4B287A, transparent 55%)" }} />}
    <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(7,5,15,.86) 0%, rgba(7,5,15,.52) 56%, rgba(7,5,15,.1) 100%)" }} />
    <div style={{ position: "absolute", left: 116, top: 225, maxWidth: 1180, opacity: fadeIn }}>
      <div style={{ color: purple, fontSize: 24, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 22 }}>{scene.mediaKind === "actual-product" ? "REAL PRODUCT DEMONSTRATION" : "CUSTOMER LIFECYCLE"}</div>
      <div style={{ fontSize: 82, fontWeight: 760, lineHeight: 1.08, letterSpacing: "-0.045em" }}>{scene.title}</div>
      {scene.description ? <div style={{ marginTop: 29, fontSize: 33, lineHeight: 1.35, color: "#DDD5EC", maxWidth: 1000 }}>{scene.description}</div> : null}
    </div>
    {!scene.mediaUrl && <div style={{ position: "absolute", bottom: 110, left: 116, color: "#D4C5EA", fontSize: 23 }}>Awaiting approved {scene.mediaKind === "actual-product" ? "dashboard recording" : "customer footage"}</div>}
  </AbsoluteFill>;
}

export const FluxknightBrandFilm: React.FC<FluxknightBrandFilmProps> = (props) => {
  const { fps } = useVideoConfig();
  validateBrandFilm(props);
  let offset = 0;
  return <AbsoluteFill style={backdrop}>
    {props.scenes.map(scene => {
      const from = offset;
      const frames = Math.max(1, Math.ceil(scene.durationSeconds * fps));
      offset += frames;
      return <Sequence key={scene.id} from={from} durationInFrames={frames}>
        <FilmShot scene={scene} />
        {scene.narrationUrl ? <Audio src={scene.narrationUrl} /> : null}
      </Sequence>;
    })}
    {props.musicUrl ? <Audio src={props.musicUrl} loop volume={0.09} /> : null}
    <div style={{ position: "absolute", top: 48, left: 100, right: 100, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
      <Img src={props.logoUrl} style={{ height: 100, maxWidth: 285, objectFit: "contain", objectPosition: "left" }} />
      <span style={{ color: "#C6B4E6", fontSize: 22, letterSpacing: "0.13em" }}>FLUXKNIGHT</span>
    </div>
    <div style={{ position: "absolute", bottom: 44, left: 104, right: 104, display: "flex", justifyContent: "space-between", color: "#C7BAE7", fontSize: 24, zIndex: 10 }}>
      <span>{props.website ?? "fluxknight.space"}</span>
      <span>{props.tagline ?? "Automate for speed, scale without boundaries."}</span>
    </div>
  </AbsoluteFill>;
};
