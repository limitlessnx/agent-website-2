import { createHmac, timingSafeEqual } from "node:crypto";

type Json = Record<string, unknown>;

export function text(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export function record(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

export function firstText(...values: unknown[]) {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return "";
}

export function verifyElevenLabsSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, ...rest] = part.split("=");
    return [key.trim(), rest.join("=").trim()];
  }));
  const timestamp = parts.t || parts.timestamp;
  const supplied = parts.v0 || parts.signature || "";
  if (!timestamp || !supplied) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber * 1000) > 5 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function payloadData(payload: Json) {
  return record(payload.data || payload);
}

export function conversationId(payload: Json) {
  const data = payloadData(payload);
  return firstText(data.conversation_id, data.conversationId, payload.conversation_id, payload.conversationId);
}

export function eventType(payload: Json) {
  return firstText(payload.type, payload.event_type, payload.eventType, "post_call_transcription");
}

export function durationSeconds(payload: Json) {
  const data = payloadData(payload);
  const metadata = record(data.metadata || payload.metadata);
  const analysis = record(data.analysis || payload.analysis);
  const candidates = [data.duration_seconds, data.durationSeconds, data.call_duration_seconds, metadata.duration_seconds, metadata.duration, analysis.duration_seconds];
  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number) && number >= 0) return Math.round(number);
  }
  return 0;
}

export function transcript(payload: Json) {
  const data = payloadData(payload);
  return firstText(data.transcript, data.transcription, record(data.conversation).transcript).slice(0, 50000);
}

export function analysis(payload: Json) {
  const data = payloadData(payload);
  return record(data.analysis || payload.analysis);
}

export function metadata(payload: Json) {
  const data = payloadData(payload);
  return record(data.metadata || payload.metadata);
}
