"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function FluxMotionDirector() {
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.fromTo(".fk-strict-home [data-flux-step]", { y: 24 }, {
      y: 0,
      stagger: 0.12,
      ease: "power2.out",
      scrollTrigger: { trigger: ".fk-story-canvas", start: "top 78%", once: true },
    });

    const astralDashboard = document.querySelector<HTMLElement>(".astral-insights [data-astral-reveal]");
    if (astralDashboard) {
      gsap.fromTo(astralDashboard, { y: 30, scale: 0.97 }, {
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: astralDashboard, start: "top 82%", once: true },
      });
    }

    const astralCards = gsap.utils.toArray<HTMLElement>(".astral-insights [data-astral-stagger] .astral-feature");
    if (astralCards.length) {
      gsap.fromTo(astralCards, { y: 24 }, {
        y: 0,
        duration: 0.55,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: { trigger: ".astral-insights [data-astral-stagger]", start: "top 84%", once: true },
      });
    }

    const platformReveal = document.querySelector<HTMLElement>(".fk-platform [data-fk-reveal]");
    if (platformReveal) {
      gsap.fromTo(platformReveal, { y: 36, scale: 0.97 }, {
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: platformReveal, start: "top 86%", once: true },
      });
    }

    const platformCards = gsap.utils.toArray<HTMLElement>(".fk-platform [data-fk-stagger] .fk-agent-card");
    if (platformCards.length) {
      gsap.fromTo(platformCards, { y: 24 }, {
        y: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: { trigger: ".fk-platform [data-fk-stagger]", start: "top 84%", once: true },
      });
    }
  });

  return null;
}
