import type { Metadata } from "next";
import EvaluationClient from "./EvaluationClient";

export const metadata: Metadata = {
  title: "Business AI Evaluation",
  description:
    "Tell Fluxknight what your business wants to improve or automate. We evaluate the need first, then recommend the right AI agents, channels, integrations, and workflows.",
};

export default function EvaluationPage() {
  return <EvaluationClient />;
}
