import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resendApi } from "@/lib/fluxknight-mail";
import { GENCOUV_EMAIL, GENCOUV_SENDERS, GENCOUV_UUID, GencouvRequestError } from "@/lib/gencouv-admin";

export type GencouvSendInput = {
  request_id: string; from: string; subject: string; text: string; contact_ids?: string[];
  to?: string; category_id?: string; campaign_id?: string; mode: "one_time" | "proposal";
  reply_message_id?: string; reply_headers?: Record<string,string>;
  confirmed: boolean; consent_confirmed?: boolean;
};
type ReservedMessage = { id: string; recipient_email: string; recipient_name: string | null; provider_email_id?: string | null; status: string };
type Reservation = { created: boolean; batch_id: string; status: string; messages: ReservedMessage[] };

export function validateGencouvSend(input: GencouvSendInput) {
  const sender = String(input.from || "").trim().toLowerCase();
  const subject = String(input.subject || "").trim();
  const text = String(input.text || "").trim();
  if (!GENCOUV_UUID.test(String(input.request_id || ""))) throw new GencouvRequestError("A stable send request ID is required. Reload the composer.");
  if (!GENCOUV_SENDERS.has(sender) || !subject || subject.length > 200 || /[\r\n]/.test(subject) || !text || text.length > 30000 || input.confirmed !== true) throw new GencouvRequestError("Review a valid sender, subject and message, then confirm the send.");
  if (/\[[^\]\n]{1,80}\]/.test(subject) || /\[(?!Name\])[^\]\n]{1,80}\]/i.test(text)) throw new GencouvRequestError("Replace message placeholders before sending.");
  const ids = input.contact_ids || [];
  if (input.mode === "one_time") {
    if (input.consent_confirmed !== true || !Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some(id => !GENCOUV_UUID.test(id)) || new Set(ids).size !== ids.length) throw new GencouvRequestError("Choose 1–100 distinct contacts with recorded permission and confirm consent.");
  } else if (input.mode !== "proposal" || !GENCOUV_EMAIL.test(String(input.to || "")) || String(input.to).length > 254 || /\[[^\]\n]+\]/.test(text)) {
    throw new GencouvRequestError("A valid, reviewed one-recipient proposal is required.");
  }
  for (const id of [input.category_id, input.campaign_id, input.reply_message_id].filter(Boolean)) if (!GENCOUV_UUID.test(id!)) throw new GencouvRequestError("Invalid campaign or category.");
  return { ...input, from: sender, subject, text, to: input.to?.trim().toLowerCase(), contact_ids: [...ids].sort() };
}

function savedResult(reservation: Reservation, replayed: boolean) {
  const messages = reservation.messages || [];
  const accepted = messages.filter(message => Boolean(message.provider_email_id)).length;
  return { batch_id: reservation.batch_id, status: reservation.status, accepted, tracked: true, replayed,
    recipient_count: messages.length,
    messages: messages.map(message => ({ id: message.id, status: message.status, provider_email_id: message.provider_email_id || null })),
    note: ["unknown", "partial", "submitting"].includes(reservation.status)
      ? "This submission needs reconciliation. Do not create another send request for these recipients."
      : reservation.status === "failed" ? "The provider rejected this batch. Correct the problem before preparing a new reviewed attempt."
      : reservation.status === "cancelled" ? "This batch was cancelled before provider submission. Review recipient eligibility before a new attempt."
      : replayed ? "The saved result was returned. No duplicate provider submission was made."
      : "Provider submission recorded. Acceptance does not confirm delivery." };
}

/** Existing message ledger is reserved before provider access. A replay never calls Resend. */
export async function sendGencouvBatch(db: SupabaseClient, organizationId: string, actor: string, raw: GencouvSendInput) {
  const input = validateGencouvSend(raw);
  if(input.mode === "one_time" && !unsubscribeSecret()) throw new GencouvRequestError("Unsubscribe signing is not configured. Nothing was submitted.",503);
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const { data, error } = await db.rpc("gencouv_reserve_send_batch", {
    p_organization_id: organizationId, p_request_key: input.request_id, p_request_hash: requestHash,
    p_input: input, p_actor: actor,
  });
  if (error) {
    const known = String(error.message || "");
    const safe = ["Daily sending limit reached", "Contact permission or suppression check failed", "Duplicate campaign recipient", "Request ID was already used for different content", "Campaign is not available", "Invalid recipient selection"].find(message => known.includes(message));
    throw new GencouvRequestError(safe || "The send could not be reserved. Nothing was submitted.", safe ? 409 : 503);
  }
  const reservation = data as Reservation;
  if (!reservation?.batch_id || !Array.isArray(reservation.messages)) throw new GencouvRequestError("Reservation could not be confirmed. Check history before retrying.", 503);
  // Only a queued reservation is provably before provider authorization.
  // An explicit retry may claim it once; submitting/unknown outcomes stay held.
  if (!reservation.created && reservation.status !== "queued") return savedResult(reservation, true);
  const authorized = await db.rpc("gencouv_authorize_send_batch", { p_organization_id: organizationId, p_batch_id: reservation.batch_id });
  if (authorized.error || authorized.data !== true) throw new GencouvRequestError("The saved batch is not authorized for submission. Check its history before retrying.", 409);
  const unsubscribeOrigin = (process.env.NEXT_PUBLIC_SITE_URL || "https://fluxknight.space").replace(/\/$/, "");
  const emails = reservation.messages.map(message => {
    const unsubscribe = `${unsubscribeOrigin}/api/gencouv/unsubscribe?message=${encodeURIComponent(message.id)}&token=${input.mode === "one_time" ? unsubscribeToken(message.id) : ""}`;
    const body = input.text.replace(/\[Name\]/gi, message.recipient_name || "there");
    return { from: `Gencouv <${input.from}>`, to: [message.recipient_email], reply_to: input.from, subject: input.subject,
      text: input.mode === "one_time" ? `${body}\n\nUnsubscribe from Gencouv marketing: ${unsubscribe}` : body,
      ...(input.mode === "one_time" ? { headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : input.reply_headers ? {headers:input.reply_headers} : {}),
      tags: [{ name: "gencouv_message_id", value: message.id }, { name: "gencouv_batch_id", value: reservation.batch_id }] };
  });
  let receiptIds: Array<string | null> = [];
  let outcome = "unknown";
  let summary: string | null = null;
  try {
    const result = await resendApi("/emails/batch", { method: "POST", headers: { "Idempotency-Key": `gencouv-batch-${reservation.batch_id}` }, body: JSON.stringify(emails) });
    const receipts = Array.isArray(result.data) ? result.data : [];
    receiptIds = emails.map((_, index) => typeof receipts[index]?.id === "string" && GENCOUV_UUID.test(receipts[index].id) ? receipts[index].id : null);
    const seen = new Set<string>(); receiptIds = receiptIds.map(id => { if(!id || seen.has(id)) return null; seen.add(id); return id; });
    outcome = receiptIds.length === receipts.length && receiptIds.every(Boolean) && new Set(receiptIds).size === receiptIds.length ? "submitted" : "partial";
    if (outcome === "partial") summary = "Provider response was incomplete. Reconcile saved recipient IDs before any further submission.";
  } catch (error) {
    // Network errors and 5xx can follow acceptance. Persist unknown and never auto-retry.
    const status = error instanceof Error ? error.message.match(/^Resend (\d{3}):/)?.[1] : null;
    outcome = status && ["400", "401", "403", "404", "413", "422", "429"].includes(status) ? "failed" : "unknown";
    summary = outcome === "failed" ? "Provider rejected the request. Review configuration or limits before an explicit new attempt." : "Provider acceptance is uncertain. Reconcile before any further submission.";
  }
  const saved = await db.rpc("gencouv_finish_send_batch", { p_organization_id: organizationId, p_batch_id: reservation.batch_id,
    p_outcome: outcome, p_provider_ids: receiptIds, p_error: summary });
  if (saved.error || !saved.data) return { ...savedResult({ ...reservation, status: "unknown" }, false), tracked: false, note: "Provider submission may have occurred, but its final ledger update is unavailable. The durable reservation blocks a duplicate. Reconcile this batch." };
  return savedResult(saved.data as Reservation, false);
}

function unsubscribeSecret() { return process.env.GENCOUV_UNSUBSCRIBE_SECRET || process.env.ADMIN_SESSION_SECRET || ""; }
export function unsubscribeToken(messageId: string) {
  const secret = unsubscribeSecret();
  if (!secret) throw new GencouvRequestError("Unsubscribe signing is not configured. Nothing was submitted.", 503);
  return createHmac("sha256", secret).update(`gencouv-unsubscribe:${messageId}`).digest("base64url");
}
export function verifyGencouvUnsubscribe(messageId: string, token: string) {
  if (!GENCOUV_UUID.test(messageId) || !token || !unsubscribeSecret()) return false;
  const expected = Buffer.from(unsubscribeToken(messageId)); const supplied = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
