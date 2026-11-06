import { logger, task } from "@trigger.dev/sdk";
import WebSocket from "ws";
import { maiaEstateTools } from "@/lib/ai/maia-estate-tools";
import { maiaPropertyTools } from "@/lib/ai/maia-property-tools";
import { LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-data";

type Json = Record<string, unknown>;

type MaiaSidebandPayload = {
  callId: string;
  organizationId: string;
  agentId: string;
  customerPhone: string;
  customerName?: string;
};

type VoiceTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (input: Record<string, unknown>, context: { organizationId: string; agentId: string; sessionId: string; customerPhone?: string }) => Promise<unknown>;
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
    ...maiaPropertyTools().filter((tool) => ["search_properties", "get_property_media", "send_property_details_to_whatsapp"].includes(tool.name)),
  ];
}

function toolSchemas(tools: VoiceTool[]) {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: `${tool.description} ${tool.name === "send_property_details_to_whatsapp" ? "This is an explicit customer-requested WhatsApp delivery action; do not claim it succeeded unless the tool result proves it." : "This is a read-only voice lookup; do not claim an action was completed unless the tool result proves it."}`,
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

async function runSideband(input: MaiaSidebandPayload) {
  if (!input.callId || !input.organizationId || !input.agentId) throw new Error("Maia sideband requires callId, organizationId and agentId.");
  if (input.organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID) throw new Error("The Maia WhatsApp voice sideband is restricted to Limitless Realty.");
  const tools = toolsForVoice();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const socket = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(input.callId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  return await new Promise<{ ok: true; callId: string; tools: string[] }>((resolve, reject) => {
    let settled = false;
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
            customerPhone: input.customerPhone,
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
      send(socket, {
        type: "session.update",
        session: {
          type: "realtime",
          instructions: [
            "You are Maia for Limitless Realty. Use the approved read-only estate and property tools when a caller asks for current property or estate facts.",
            "Search before answering named-property questions. Use an exact returned ID before requesting estate knowledge or media metadata.",
            "Never invent availability, price, payment terms, title status, or estate facts. If a tool returns ambiguity or no match, ask a concise clarification.",
            "If the caller explicitly asks you to send the exact property details in WhatsApp, first search and confirm one exact property, then use send_property_details_to_whatsapp. Tell the caller that delivery is attempted only to the verified existing chat and only while the WhatsApp customer-service window is open. Do not claim delivery unless the tool confirms it.",
            `Caller: ${safeText(input.customerName, 180) || "unknown"}; phone: ${safeText(input.customerPhone, 80) || "unknown"}.`,
          ].join("\n\n"),
          tools: toolSchemas(tools),
          tool_choice: "auto",
        },
      });
      logger.info("Maia WhatsApp sideband attached", { callId: input.callId, organizationId: input.organizationId, tools: tools.map((tool) => tool.name) });
    });
    socket.on("message", (data) => void handleMessage(data));
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
      finish();
    });
  });
}

export const maiaWhatsAppCallSideband = task({
  id: "maia-whatsapp-call-sideband",
  maxDuration: 300,
  retry: { maxAttempts: 2, minTimeoutInMs: 2_000, maxTimeoutInMs: 10_000, factor: 2 },
  run: async (payload: MaiaSidebandPayload) => runSideband(payload),
});
