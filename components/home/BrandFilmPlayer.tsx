"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import styles from "./BrandFilmSection.module.css";

type BrandFilmPlayerProps = {
  videoId: string;
  poster: string;
};

export default function BrandFilmPlayer({ videoId, poster }: BrandFilmPlayerProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  // Privacy-enhanced YouTube iframe is created only after an explicit user click.
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;

  return (
    <div className={styles.playerFrame}>
      {hasStarted ? (
        <iframe
          className={styles.player}
          src={embedUrl}
          title="Fluxknight: The Complete Customer Journey brand film"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      ) : (
        <div className={styles.poster} style={{ backgroundImage: `url("${poster}")` }}>
          <div className={styles.posterOverlay}>
            <span className={styles.videoTag}>The complete customer journey · Brand film</span>
            <button
              type="button"
              className={styles.playButton}
              onClick={() => setHasStarted(true)}
              aria-label="Play the Fluxknight brand film on YouTube"
            >
              <Play size={30} fill="currentColor" aria-hidden="true" />
            </button>
            <span className={styles.videoHint}>Watch the film · Sound on when played</span>
          </div>
        </div>
      )}
      <a className={styles.youtubeLink} href={youtubeUrl} target="_blank" rel="noopener noreferrer">
        Watch on YouTube
      </a>
    </div>
  );
}
