import type { Metadata } from "next";
import EvaluationClient from "./EvaluationClient";

export const metadata: Metadata = {
  title: "AI Evaluation Call",
  description:
    "Start an AI evaluation call and tell us what kind of automation agent you want built for your business.",
};

export default function EvaluationPage() {
  return <EvaluationClient />;
}
