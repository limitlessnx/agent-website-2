import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const MAX_MUSIC_BYTES = 20 * 1024 * 1024;
export const MUSIC_TYPES = ["audio/mpeg", "audio/wav", "audio/mp4"];
type Ticket = { organizationId: string; brandId: string; path: string; fileName: string; mimeType: string; size: number; makeDefault: boolean; expires: number };

export function validateMusicInput(input: { size: number; mimeType: string; licensed: boolean }) {
  if (!input.licensed) throw new Error("Confirm that you have permission to use this audio in published social videos.");
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_MUSIC_BYTES) throw new Error("Choose an audio file no larger than 20 MB.");
  if (!MUSIC_TYPES.includes(input.mimeType)) throw new Error("Choose an MP3, WAV or M4A file.");
}
export function createMusicTicket(input: Omit<Ticket, "path" | "expires">, key: string) {
  const ext = input.mimeType === "audio/mpeg" ? "mp3" : input.mimeType === "audio/wav" ? "wav" : "m4a";
  const ticket: Ticket = { ...input, path: `${input.organizationId}/music/${randomUUID()}.${ext}`, expires: Date.now() + 30 * 60_000 };
  const body = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return { ticket, receipt: `${body}.${createHmac("sha256", key).update(body).digest("base64url")}` };
}
export function verifyMusicTicket(receipt: string, key: string, organizationId: string): Ticket {
  const parts = receipt.split(".");
  if (parts.length !== 2) throw new Error("Upload session is invalid. Start the upload again.");
  const expected = Buffer.from(createHmac("sha256", key).update(parts[0]).digest("base64url"));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("Upload session is invalid. Start the upload again.");
  const ticket = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as Ticket;
  if (ticket.organizationId !== organizationId || ticket.expires < Date.now() || !ticket.path.startsWith(`${organizationId}/music/`)) throw new Error("Upload session expired or belongs to another workspace.");
  return ticket;
}
export function isAudioSignature(bytes: Uint8Array, mimeType: string) {
  const text = (from: number, to: number) => Buffer.from(bytes.slice(from, to)).toString("ascii");
  if (mimeType === "audio/wav") return text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
  if (mimeType === "audio/mp4") return text(4, 8) === "ftyp";
  return text(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224);
}
