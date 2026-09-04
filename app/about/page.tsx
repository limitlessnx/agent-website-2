import type { Metadata } from "next";
import AboutOutcomeClient from "./AboutOutcomeClient";

export const metadata: Metadata = {
  title: "About Fluxknight",
  description: "How Fluxknight helps organizations respond faster, convert more opportunities, reduce repetitive work, and deploy AI automation without losing operational control.",
};

export default function AboutPage() {
  return <AboutOutcomeClient />;
}
