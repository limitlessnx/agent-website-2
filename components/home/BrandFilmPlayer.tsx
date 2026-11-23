"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import styles from "./BrandFilmSection.module.css";

type BrandFilmPlayerProps = {
  src: string;
  poster: string;
  captionsSrc?: string;
};

export default function BrandFilmPlayer({ src, poster, captionsSrc }: BrandFilmPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);

  function handleStart() {
    const video = videoRef.current;
    if (!video) return;
    setHasStarted(true);
    setPlaybackError(false);
    // Play from the user gesture, not from an automatic effect.
    void video.play().catch(() => {
      setPlaybackError(true);
    });
  }

  return (
    <div className={styles.playerFrame}>
      <video
        ref={videoRef}
        className={styles.player}
        src={src}
        poster={poster}
        preload="none"
        playsInline
        controls={hasStarted}
        onError={() => setPlaybackError(true)}
        aria-label="Fluxknight complete customer journey brand film"
      >
        {captionsSrc ? (
          <track src={captionsSrc} kind="captions" srcLang="en" label="English" default />
        ) : null}
        Your browser does not support HTML video.
      </video>
      {!hasStarted && (
        <div className={styles.posterOverlay}>
          <span className={styles.videoTag}>The complete customer journey · Brand film</span>
          <button type="button" className={styles.playButton} onClick={handleStart} aria-label="Play Fluxknight brand film with sound">
            <Play size={30} fill="currentColor" aria-hidden="true" />
          </button>
          <span className={styles.videoHint}>Watch the film · Sound on when played</span>
        </div>
      )}
      {playbackError && (
        <div role="alert" className={styles.errorNotice}>
          Video playback is unavailable. <a href={src} target="_blank" rel="noopener noreferrer">Open the film in a new tab</a>.
        </div>
      )}
    </div>
  );
}
