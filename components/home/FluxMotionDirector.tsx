"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function FluxMotionDirector() {
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.utils.toArray<HTMLElement>(".fk-strict-home [data-flux-media]").forEach((media) => {
      gsap.timeline({
        scrollTrigger: { trigger: media, start: "top bottom", end: "bottom top", scrub: true },
      })
        .fromTo(media, { scale: 0.8, opacity: 0.3 }, { scale: 1, opacity: 1, ease: "none", duration: 1 })
        .to(media, { scale: 0.98, opacity: 0.35, ease: "none", duration: 0.4 });
    });

    const words = gsap.utils.toArray<HTMLElement>(".fk-strict-home [data-flux-word]");
    if (words.length) {
      gsap.fromTo(words, { opacity: 0.14 }, {
        opacity: 1,
        ease: "none",
        stagger: 0.06,
        scrollTrigger: {
          trigger: ".fk-story-copy",
          start: "top 78%",
          end: "bottom 48%",
          scrub: true,
        },
      });
    }

    gsap.fromTo(".fk-strict-home [data-flux-step]", { y: 34, opacity: 0 }, {
      y: 0,
      opacity: 1,
      stagger: 0.12,
      ease: "power2.out",
      scrollTrigger: { trigger: ".fk-story-canvas", start: "top 78%", end: "bottom 35%", scrub: true },
    });
  });

  return null;
}
