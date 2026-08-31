import type { RuntimeStreamEvent } from "@/lib/ai-runtime/types";

const encoder = new TextEncoder();

export function encodeRuntimeSse(event: RuntimeStreamEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function createRuntimeEventStream(source: AsyncIterable<RuntimeStreamEvent>) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of source) controller.enqueue(encoder.encode(encodeRuntimeSse(event)));
      } catch (error) {
        const fallback: RuntimeStreamEvent = { type: "runtime.failed", executionId: "unknown", error: error instanceof Error ? error.message : "Runtime stream failed.", at: new Date().toISOString() };
        controller.enqueue(encoder.encode(encodeRuntimeSse(fallback)));
      } finally {
        controller.close();
      }
    },
  });
}

export function runtimeStreamResponse(source: AsyncIterable<RuntimeStreamEvent>) {
  return new Response(createRuntimeEventStream(source), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function* streamTextAsRuntimeEvents(input: { executionId: string; text: string; chunkSize?: number }): AsyncGenerator<RuntimeStreamEvent> {
  const chunkSize = Math.max(16, Math.min(Number(input.chunkSize || 96), 512));
  for (let index = 0; index < input.text.length; index += chunkSize) {
    yield { type: "runtime.delta", executionId: input.executionId, delta: input.text.slice(index, index + chunkSize), at: new Date().toISOString() };
  }
}
