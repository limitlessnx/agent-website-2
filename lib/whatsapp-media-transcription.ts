import { getWhatsAppCredentials } from "@/lib/whatsapp-integration";
import type { MaiaInboundPayload } from "@/lib/ai/maia-trigger-runtime";

export async function transcribeWhatsAppAudio(payload: MaiaInboundPayload) {
  const mediaId = String(payload.metadata?.mediaId || "");
  if (String(payload.metadata?.messageType || "").toLowerCase() !== "audio" || !mediaId) return null;
  const credentials = await getWhatsAppCredentials(payload.organizationId);
  const token = String(credentials?.access_token || credentials?.accessToken || "");
  const graphVersion = String(credentials?.graph_version || "v23.0");
  if (!token) throw new Error("WhatsApp credentials are unavailable for audio transcription.");
  const mediaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store" });
  const mediaMeta = await mediaResponse.json().catch(() => ({}));
  if (!mediaResponse.ok || !mediaMeta?.url) throw new Error(String(mediaMeta?.error?.message || "WhatsApp audio media could not be resolved."));
  const audioResponse = await fetch(String(mediaMeta.url), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!audioResponse.ok) throw new Error(`WhatsApp audio download failed (${audioResponse.status}).`);
  const buffer = await audioResponse.arrayBuffer();
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: String(mediaMeta.mime_type || payload.metadata?.mimeType || "audio/ogg") }), "whatsapp-voice.ogg");
  form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
  const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}` }, body: form, cache: "no-store" });
  const transcription = await transcriptionResponse.json().catch(() => ({}));
  if (!transcriptionResponse.ok) throw new Error(String(transcription?.error?.message || `Audio transcription failed (${transcriptionResponse.status}).`));
  return String(transcription?.text || "").trim();
}
