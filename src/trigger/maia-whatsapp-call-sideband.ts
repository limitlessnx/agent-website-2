import { logger, task } from "@trigger.dev/sdk";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import WebSocket from "ws";
import { maiaEstateTools } from "@/lib/ai/maia-estate-tools";
import { maiaPropertyTools } from "@/lib/ai/maia-property-tools";
import { LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-data";
import { terminateMaiaWhatsAppCall } from "@/lib/maia-whatsapp-calling";

type Json = Record<string, unknown>;

type MaiaSidebandPayload = {
  callId: string;
  metaCallId: string;
  phoneNumberId: string;
  organizationId: string;
  agentId: string;
  customerPhone: string;
  customerName?: string;
};

type VoiceTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (input: Record<string, unknown>, context: { organizationId: string; agentId: string; sessionId: string }) => Promise<unknown>;
};

function safeText(value: unknown, max = 8000) {
  return String(value ?? "").slice(0, max);
}

function parseArguments(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function toolsForVoice(): VoiceTool[] {
  return [
    ...maiaEstateTools(),
    ...maiaPropertyTools().filter((tool) => ["search_properties", "get_property_media"].includes(tool.name)),
  ];
}

function toolSchemas(tools: VoiceTool[]) {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: `${tool.description} This is a read-only voice lookup; do not claim an action was completed unless the tool result proves it.`,
    parameters: tool.parameters,
  }));
}

function send(socket: WebSocket, event: Json) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

function socketErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { errorType: "unknown" };
  const candidate = error as { name?: unknown; message?: unknown; code?: unknown };
  return {
    errorType: String(candidate.name || "Error").slice(0, 120),
    errorMessage: String(candidate.message || "WebSocket connection failed.").slice(0, 500),
    errorCode: candidate.code == null ? undefined : String(candidate.code).slice(0, 80),
  };
}

function providerHandshakeError(body: string) {
  try {
    const parsed = JSON.parse(body) as Json;
    const error = parsed.error && typeof parsed.error === "object" ? parsed.error as Json : {};
    return {
      providerErrorType: String(error.type || "").slice(0, 120) || undefined,
      providerErrorCode: String(error.code || "").slice(0, 120) || undefined,
      providerErrorMessage: String(error.message || "").slice(0, 500) || undefined,
    };
  } catch {
    return { providerErrorBodyPresent: Boolean(body.trim()) };
  }
}

/**
 * Nonblocking tenant-scoped call lifecycle audit. Vercel can confirm that the
 * call was accepted, but cannot observe the separate Trigger.dev worker.
 * Keep credentials, phone numbers, SDP, and transcript content out of logs.
 */
async function auditSideband(input: MaiaSidebandPayload, stage: string, data: Json = {}) {
  try {
    const { error } = await createAdminClient().from("whatsapp_webhook_event_logs").insert({
      request_id: `maia-voice-sideband:${randomUUID()}`,
      event_type: "maia_voice_sideband",
      organization_id: input.organizationId,
      provider_message_id: input.metaCallId,
      http_status: stage === "failed" ? 500 : 200,
      details: {
        stage,
        agent_id: input.agentId,
        ...data,
      },
    });
    if (error) logger.warn("Maia voice lifecycle audit write failed", { stage, errorCode: error.code || "unknown" });
  } catch (error) {
    logger.warn("Maia voice lifecycle audit unavailable", { stage, errorType: error instanceof Error ? error.name : "unknown" });
  }
}

async function runSideband(input: MaiaSidebandPayload) {
  if (!input.callId || !input.metaCallId || !input.phoneNumberId || !input.organizationId || !input.agentId) {
    throw new Error("Maia sideband requires realtime call, WhatsApp call, phone number, organization and agent identifiers.");
  }
  if (input.organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID) throw new Error("The Maia WhatsApp voice sideband is restricted to Limitless Realty.");
  try {
  await auditSideband(input, "started");
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is missing from the Trigger.dev production environment.");
  const tools = toolsForVoice();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  for (let attempt = 1; attempt <= 3; attempt += 1) {
  const socket = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(input.callId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    },
  });
  try {
    return await new Promise<{ ok: true; callId: string; tools: string[] }>((resolve, reject) => {
    let settled = false;
    let greetingStarted = false;
    let audioStarted = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve({ ok: true, callId: input.callId, tools: tools.map((tool) => tool.name) });
    };
    const handleMessage = async (raw: unknown) => {
      let event: Json;
      try {
        const text = typeof raw === "string" ? raw : raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : String(raw);
        event = JSON.parse(text) as Json;
      } catch {
        return;
      }
      const type = String(event.type || "");
      if (type === "session.updated" && !greetingStarted) {
        greetingStarted = true;
        void auditSideband(input, "session_ready");
        send(socket, {
          type: "response.create",
          response: {
            modalities: ["audio"],
            instructions: "Greet the caller warmly and briefly as Maia, then ask how you can help. Speak the greeting aloud.",
          },
        });
        logger.info("Maia WhatsApp call greeting started", { callId: input.callId });
        return;
      }
      if ((type === "response.audio.delta" || type === "response.output_audio.delta") && !audioStarted) {
        audioStarted = true;
        void auditSideband(input, "audio_started");
      }
      if (type === "response.done" && greetingStarted && !audioStarted) {
        void auditSideband(input, "response_without_audio");
      }
      if (type === "error") {
        logger.error("Maia sideband reported an OpenAI error", { callId: input.callId, error: event.error || event });
        return;
      }
      if (type === "response.function_call_arguments.done") {
        const name = String(event.name || "");
        const callId = String(event.call_id || "");
        const tool = byName.get(name);
        let output: unknown;
        try {
          if (!tool || !callId) throw new Error("The requested Maia voice tool is not allowed.");
          output = await tool.execute(parseArguments(event.arguments), {
            organizationId: input.organizationId,
            agentId: input.agentId,
            sessionId: input.callId,
          });
        } catch (error) {
          output = { ok: false, error: error instanceof Error ? error.message : "Maia voice tool failed." };
        }
        send(socket, { type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output).slice(0, 30000) } });
        send(socket, { type: "response.create", response: { modalities: ["audio"] } });
      }
      if (["session.closed", "conversation.ended", "call.ended"].includes(type)) finish();
    };
    socket.on("open", () => {
      void auditSideband(input, "socket_open");
      send(socket, {
        type: "session.update",
        session: {
          type: "realtime",
          instructions: [
            "You are Maia for Limitless Realty. Use the approved read-only estate and property tools when a caller asks for current property or estate facts.",
            "Search before answering named-property questions. Use an exact returned ID before requesting estate knowledge or media metadata.",
            "Never invent availability, price, payment terms, title status, or estate facts. If a tool returns ambiguity or no match, ask a concise clarification.",
            "Do not send WhatsApp media or perform CRM mutations from this live call yet. Offer to continue in WhatsApp or hand off to the Limitless Realty team.",
            `Caller: ${safeText(input.customerName, 180) || "unknown"}; phone: ${safeText(input.customerPhone, 80) || "unknown"}.`,
          ].join("\n\n"),
          tools: toolSchemas(tools),
          tool_choice: "auto",
        },
      });
      logger.info("Maia WhatsApp sideband attached", { callId: input.callId, organizationId: input.organizationId, tools: tools.map((tool) => tool.name) });
    });
    socket.on("message", (data) => void handleMessage(data));
    socket.on("unexpected-response", (_request, response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        if (body.length < 4096) body += chunk.slice(0, 4096 - body.length);
      });
      response.on("end", () => {
        logger.error("Maia OpenAI sideband handshake rejected", {
          callId: input.callId,
          statusCode: response.statusCode,
          requestId: String(response.headers["x-request-id"] || "").slice(0, 120) || undefined,
          ...providerHandshakeError(body),
        });
        finish(new Error(`Maia OpenAI sideband connection failed (HTTP ${response.statusCode || "unknown"}).`));
      });
      response.on("error", (error) => {
        logger.error("Maia OpenAI sideband response read failed", {
          callId: input.callId,
          statusCode: response.statusCode,
          requestId: String(response.headers["x-request-id"] || "").slice(0, 120) || undefined,
          ...socketErrorDetails(error),
        });
        finish(new Error(`Maia OpenAI sideband connection failed (HTTP ${response.statusCode || "unknown"}).`));
      });
    });
    socket.on("error", (error) => {
      logger.error("Maia OpenAI sideband WebSocket failed", {
        callId: input.callId,
        ...socketErrorDetails(error),
      });
      finish(new Error("Maia OpenAI sideband connection failed."));
    });
    socket.on("close", (code, reason) => {
      logger.info("Maia OpenAI sideband WebSocket closed", {
        callId: input.callId,
        closeCode: code,
        closeReason: String(reason || "").slice(0, 500),
      });
      void auditSideband(input, "socket_closed", {
        close_code: code,
        greeting_started: greetingStarted,
        audio_started: audioStarted,
      });
      if (!greetingStarted) finish(new Error("Maia voice sideband closed before greeting initialization."));
      else if (!audioStarted) finish(new Error("Maia voice sideband closed before audio output."));
      else finish();
    });
    });
  } catch (connectionError) {
    // The WebRTC call can become visible to the sideband shortly after
    // signaling completes. Retry only a missing session, never auth/other errors.
    if (attempt >= 3 || !String(connectionError).includes("HTTP 404")) throw connectionError;
    logger.warn("Maia sideband attach returned 404; retrying briefly", { attempt });
    await auditSideband(input, "attach_retry", { attempt, http_status: 404 });
    await new Promise((resolve) => setTimeout(resolve, attempt * 350));
  }
  }
  throw new Error("Maia voice sideband attachment retries were exhausted.");
  } catch (error) {
    await auditSideband(input, "failed", { error_type: error instanceof Error ? error.name : "unknown" });
    try {
      await terminateMaiaWhatsAppCall({ organizationId: input.organizationId, phoneNumberId: input.phoneNumberId, callId: input.metaCallId });
      logger.warn("Maia WhatsApp call terminated after sideband failure", { callId: input.metaCallId });
    } catch (terminationError) {
      logger.error("Maia WhatsApp call termination failed after sideband failure", {
        callId: input.metaCallId,
        errorType: terminationError instanceof Error ? terminationError.name : "unknown",
        errorMessage: terminationError instanceof Error ? terminationError.message.slice(0, 500) : "Unknown termination failure",
      });
    }
    throw error;
  }
}

export const maiaWhatsAppCallSideband = task({
  id: "maia-whatsapp-call-sideband",
  maxDuration: 300,
  retry: { maxAttempts: 1 },
  run: async (payload: MaiaSidebandPayload) => runSideband(payload),
});

