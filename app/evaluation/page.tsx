import type { Metadata } from "next";
import EvaluationClient from "./EvaluationClient";

export const metadata: Metadata = {
  title: "Business AI Evaluation",
  description:
    "Tell Fluxknight what your business wants to improve or automate. We evaluate the need first, then recommend the right AI agents, channels, integrations, and workflows.",
};

export default function EvaluationPage() {
  return (
    <>
      <EvaluationClient />
      <style>{`
        html, body { overflow-x: hidden; }
        @media (max-width: 900px) {
          .evaluation-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 28px !important;
            width: 100% !important;
          }
          .evaluation-grid > aside,
          .evaluation-grid > div {
            min-width: 0 !important;
            width: 100% !important;
          }
          .evaluation-grid aside > div {
            position: static !important;
          }
        }
        @media (max-width: 640px) {
          .evaluation-grid { gap: 22px !important; }
          .evaluation-two-col {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 14px !important;
          }
          .evaluation-grid input,
          .evaluation-grid select,
          .evaluation-grid textarea {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </>
  );
}
