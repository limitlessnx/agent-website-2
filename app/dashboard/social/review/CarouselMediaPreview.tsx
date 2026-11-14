"use client";

import { useState } from "react";
import styles from "./review.module.css";

type Slide = { id: string; src: string; label: string };

export function CarouselMediaPreview({ slides, title }: { slides: Slide[]; title: string }) {
  const [selected, setSelected] = useState(0);
  if (!slides.length) return null;
  const active = slides[Math.min(selected, slides.length - 1)];
  return (
    <div className={styles.carouselViewer} aria-label="Generated carousel preview">
      <div className={styles.carouselStage}>
        <img src={active.src} alt={`${title}: slide ${selected + 1} of ${slides.length}`}
          className={styles.carouselHero} />
      </div>
      <div className={styles.carouselNavigation}>
        <button type="button" onClick={() => setSelected((n) => Math.max(n - 1, 0))}
          disabled={selected === 0} className={styles.carouselNavButton} aria-label="Previous slide">
          ← Previous
        </button>
        <span className={styles.carouselCount} aria-live="polite">Slide {selected + 1} of {slides.length}</span>
        <button type="button" onClick={() => setSelected((n) => Math.min(n + 1, slides.length - 1))}
          disabled={selected === slides.length - 1} className={styles.carouselNavButton} aria-label="Next slide">
          Next →
        </button>
      </div>
      <div className={styles.carouselThumbs} aria-label="Select carousel slide">
        {slides.map((slide, index) => (
          <button key={slide.id} type="button" onClick={() => setSelected(index)}
            className={`${styles.carouselThumb} ${selected === index ? styles.carouselThumbSelected : ""}`}
            aria-pressed={selected === index} aria-label={`Preview slide ${index + 1}`}>
            <img src={slide.src} alt="" loading="lazy" />
            <span>{index + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
