/**
 * Server-only Brevo email adapter for the Gencouv workspace.
 *
 * This module deliberately does not enable sending or set a default provider.
 * The Gencouv sender/domain must first be verified in Brevo, and callers must
 * perform tenant authorization, consent/suppression and quota checks.
 * Never import this module from a client component.
 */
import "server-only";

const BREVO_API = "https://api.brevo.com/v3";
export type GencouvEmailProvider = "resend" | "brevo";

export function parseGencouvEmailProvider(value: unknown): GencouvEmailProvider | null {
  if (value === "resend" || value === "brevo") return value;
  return null;
}

export function isBrevoSenderAddress(value: unknown): value is string {
  return typeof value === "string" && value === value.trim().toLowerCase() &&
    value.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value) &&
    !value.endsWith("@gencouv.com");
}

type BrevoIndividualEmail = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

type BrevoMarketingEmail = BrevoIndividualEmail & { unsubscribeUrl: string };

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, character => entities[character]);
}

function htmlFor(email: BrevoMarketingEmail) {
  return '<html><body><div style="white-space:pre-wrap">' + escapeHtml(email.text) +
    '</div><p><a href="' + escapeHtml(email.unsubscribeUrl) +
    '">Unsubscribe from Gencouv marketing</a></p></body></html>';
}

function validUnsubscribeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      url.pathname === "/api/gencouv/unsubscribe" &&
      Boolean(url.searchParams.get("message") && url.searchParams.get("token"));
  } catch {
    return false;
  }
}

export async function submitGencouvBrevoBatch(emails: BrevoMarketingEmail[], batchId: string) {
  const receiptIds: Array<string | null> = emails.map(() => null);
  const incomplete = { receiptIds, outcome: "unknown", summary: "Brevo submission uncertain; reconcile before any further submission." };
  const key = process.env.GENCOUV_BREVO_API_KEY;
  if (!key || process.env.GENCOUV_BREVO_SENDING_ENABLED !== "true" || !emails.length || emails.length > 100 || !/^[0-9a-f-]{36}$/i.test(batchId)) return incomplete;
  const first = emails[0];
  if (emails.some(e => !isBrevoSenderAddress(e.from) || e.from !== first.from || e.subject !== first.subject || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e.to) || e.to.length > 254 || !e.text.trim() || e.text.length > 32000 || !validUnsubscribeUrl(e.unsubscribeUrl)) || new Set(emails.map(e=>e.to.toLowerCase())).size!==emails.length) return incomplete;
  try {
    const response = await fetch(BREVO_API + "/smtp/email", {
      method:"POST", headers:{"api-key":key,"Content-Type":"application/json"},
      body:JSON.stringify({sender:{email:first.from,name:"Gencouv Capital"},replyTo:{email:first.from},subject:first.subject,
        htmlContent:"<html><body></body></html>",headers:{idempotencyKey:batchId},tags:["gencouv-"+batchId],
        messageVersions:emails.map(e=>({to:[{email:e.to}],htmlContent:htmlFor(e)}))}),
      cache:"no-store",signal:AbortSignal.timeout(25000)
    });
    if (!response.ok) return incomplete;
    const data = await response.json();
    const ids = data.messageIds;
    if (!Array.isArray(ids) || ids.length !== emails.length || ids.some(id=>typeof id!=="string"||!id||id.length>512||/[\r\n]/.test(id)) || new Set(ids).size!==ids.length) return incomplete;
    return { ...incomplete, summary:"Brevo accepted batch; reconcile recipient identities using authenticated batch-tag logs." };
  } catch { return incomplete; }
}
