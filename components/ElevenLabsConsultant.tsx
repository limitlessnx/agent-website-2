"use client";

import Script from "next/script";
import { createElement } from "react";

export default function ElevenLabsConsultant() {
  const agentId =
    process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ||
    "agent_4501kxv503fheb69mwxp40xeam5e";

  if (!agentId) return null;

  return (
    <>
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="afterInteractive"
      />
      <div
        aria-label="Talk to our AI Consultant"
        style={{
          position: "fixed",
          right: "20px",
          bottom: "20px",
          zIndex: 80,
        }}
      >
        {createElement("elevenlabs-convai", {
          "agent-id": agentId,
          "action-text": "Talk to our AI Consultant",
          "start-call-text": "Start voice chat",
          "end-call-text": "End conversation",
          "expand-text": "Talk to our AI Consultant",
          "listening-text": "Listening...",
          "speaking-text": "AI Consultant speaking",
          variant: "expanded",
          dismissible: "true",
        })}
      </div>
    </>
  );
}
