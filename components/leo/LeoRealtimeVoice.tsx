"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, LoaderCircle } from "lucide-react";

type VoiceState = "idle" | "connecting" | "live" | "error";

type RealtimeToolEvent = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
};

function friendlyVoiceError(value: string) {
  const text = String(value || "");
  if (/missing_model|model parameter|invalid_request_error/i.test(text)) {
    return "Leo voice needs a valid realtime model configured. I have updated the server default; please try voice again after the latest deployment.";
  }
  if (/insufficient_quota|credit_balance_exhausted|429/i.test(text)) {
    return "Leo voice is connected, but the OpenAI project needs available credits before voice can start.";
  }
  if (/OpenAI Realtime is not configured/i.test(text)) {
    return "Leo voice is not connected to an OpenAI key yet.";
  }
  return text.length > 180 ? "Leo voice could not start. Please try again in a moment." : text || "Leo voice could not start.";
}

export default function LeoRealtimeVoice({ sessionId }: { sessionId?: string }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState("");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function sendEvent(event: Record<string, unknown>) {
    const channel = channelRef.current;
    if (channel?.readyState === "open") channel.send(JSON.stringify(event));
  }

  async function handleToolCall(event: RealtimeToolEvent) {
    if (event.name !== "leo_execute_tool" || !event.call_id) return;
    let args: Record<string, unknown> = {};
    try {
      args = event.arguments ? JSON.parse(event.arguments) as Record<string, unknown> : {};
    } catch {
      args = {};
    }

    let output: Record<string, unknown>;
    try {
      const response = await fetch("/api/leo/tool", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "voice",
          sessionId: sessionId || undefined,
          toolKey: String(args.tool_key || ""),
          arguments: args.arguments && typeof args.arguments === "object" && !Array.isArray(args.arguments)
            ? args.arguments
            : {},
          confirmed: args.confirmed === true,
        }),
      });
      const result = await response.json().catch(() => ({}));
      output = response.ok ? result : { ok: false, error: result.error || "Leo tool execution failed." };
    } catch (cause) {
      output = { ok: false, error: cause instanceof Error ? cause.message : "Leo tool execution failed." };
    }

    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: event.call_id,
        output: JSON.stringify(output),
      },
    });
    sendEvent({ type: "response.create" });
  }

  async function start() {
    if (state === "connecting" || state === "live") return;
    setState("connecting");
    setError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      for (const track of stream.getTracks()) peer.addTrack(track, stream);

      const audio = document.createElement("audio");
      audio.autoplay = true;
      audioRef.current = audio;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => null);
      };

      const dataChannel = peer.createDataChannel("oai-events");
      channelRef.current = dataChannel;
      dataChannel.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as RealtimeToolEvent;
          if (event.type === "response.function_call_arguments.done") void handleToolCall(event);
        } catch {
          // Ignore malformed provider events. The Realtime session continues independently.
        }
      };
      dataChannel.onopen = () => setState("live");
      dataChannel.onerror = () => {
        setError("Leo voice connection encountered an error.");
        setState("error");
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/leo/realtime/call", {
        method: "POST",
        headers: { "content-type": "application/sdp" },
        body: offer.sdp || "",
      });
      const answerSdp = await response.text();
      if (!response.ok) throw new Error(friendlyVoiceError(answerSdp || "Unable to start Leo voice."));
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (cause) {
      stop(false);
      setError(friendlyVoiceError(cause instanceof Error ? cause.message : "Unable to start Leo voice."));
      setState("error");
    }
  }

  function stop(resetState = true) {
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    if (resetState) {
      setError("");
      setState("idle");
    }
  }

  const live = state === "live";
  return (
    <div className="leo-realtime-voice">
      <button
        type="button"
        className={live ? "leo-voice-button live" : "leo-voice-button"}
        onClick={() => live ? stop() : void start()}
        disabled={state === "connecting"}
        aria-pressed={live}
        title={live ? "End voice conversation with Leo" : "Talk to Leo"}
      >
        {state === "connecting" ? <LoaderCircle size={17} className="spin" /> : live ? <MicOff size={17} /> : <Mic size={17} />}
        {state === "connecting" ? "Connecting" : live ? "End voice" : "Talk to Leo"}
      </button>
      {error ? <small className="leo-voice-error">{error}</small> : null}
    </div>
  );
}
