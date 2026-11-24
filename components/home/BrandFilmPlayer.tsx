"use client";

import Image from "next/image";
import { useState } from "react";
import { Mail, MessageCircle, Phone, Play } from "lucide-react";
import styles from "./BrandFilmSection.module.css";

type BrandFilmPlayerProps = {
  videoId: string;
};

export default function BrandFilmPlayer({ videoId }: BrandFilmPlayerProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  // Only load the privacy-enhanced embed after an explicit visitor click.
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
        <div className={styles.poster}>
          <div className={styles.posterCopy}>
            <div className={styles.posterBrand}>
              <Image src="/fluxknight-mark.svg" alt="" width={38} height={38} priority={false} />
              <span>FLUXKNIGHT</span>
            </div>
            <div className={styles.posterEyebrow}>Business automation · Meet Maia</div>
            <div className={styles.posterHeadline}>Your business.<br /><strong>Running on agentic systems.</strong></div>
            <p className={styles.posterDescription}>From the first enquiry to the next purchase. One connected customer journey.</p>
            <div className={styles.posterChannels}>
              <span><MessageCircle size={15} aria-hidden="true" /> WhatsApp Chat</span>
              <span><Phone size={15} aria-hidden="true" /> AI Voice Calls</span>
              <span><Mail size={15} aria-hidden="true" /> Email Follow-ups</span>
            </div>
          </div>
          <div className={styles.posterIllustration} aria-hidden="true">
            <div className={styles.posterHalo} />
            <div className={styles.posterPhone}>
              <Image src="/fluxknight-mark.svg" alt="" width={36} height={36} />
              <span>Maia</span>
              <small>AI Customer Concierge</small>
              <div className={styles.posterBubble}>How can I help you today?</div>
              <div className={styles.posterReply}>Your request is on its way.</div>
            </div>
          </div>
          <div className={styles.posterOverlay}>
            <button
              type="button"
              className={styles.playButton}
              onClick={() => setHasStarted(true)}
              aria-label="Play the Fluxknight brand film on YouTube"
            >
              <Play size={30} fill="currentColor" aria-hidden="true" />
            </button>
            <span className={styles.videoHint}>Watch the 89-second film</span>
          </div>
        </div>
      )}
      <a className={styles.youtubeLink} href={youtubeUrl} target="_blank" rel="noopener noreferrer">
        Watch on YouTube
      </a>
    </div>
  );
}
