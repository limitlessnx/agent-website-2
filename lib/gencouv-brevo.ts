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
const ALLOWED_SENDERS = new Set([
  "info@gencouv.com",
  "support@gencouv.com",
  "onboarding@gencouv.com",
]);

export type GencouvEmailProvider = "resend" | "brevo";

export function parseGencouvEmailProvider(value: unknown): GencouvEmailProvider | null {
  if (value === "resend" || value === "brevo") return value;
  return null;
}

export function isGencouvBrevoSender(value: unknown): value is string {
  return typeof value === "string" && ALLOWED_SENDERS.has(value.trim().toLowerCase());
}

export type BrevoIndividualEmail = {
  from: string;
  to: string;
  subject: string;
  text: string;
  // Future integration must reserve this ID durably before any provider send.
  idempotencyKey: string;
};

export async function sendGencouvBrevoIndividual(
  email: BrevoIndividualEmail,
): Promise<{ provider: "brevo"; messageId: string | null }> {
  // Fail closed until the operator explicitly enables verified Gencouv sending.
  if (process.env.GENCOUV_BREVO_SENDING_ENABLED !== "true") {
    throw new Error("Gencouv Brevo sending is not enabled.");
  }
  const apiKey = process.env.GENCOUV_BREVO_API_KEY;
  if (!apiKey) throw new Error("Brevo API key is not configured.");
  if (!isGencouvBrevoSender(email.from)) throw new Error("Unapproved Gencouv sender.");
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email.to) || email.to.length > 254) {
    throw new Error("A valid individual recipient is required.");
  }
  if (!email.subject.trim() || email.subject.length > 200 || !email.text.trim() ||
      email.text.length > 30000) {
    throw new Error("Valid subject and message required.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(email.idempotencyKey)) {
    throw new Error("Valid email idempotency key required.");
  }
  const response = await fetch(BREVO_API + "/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      // Brevo documents request idempotency for batches; do not assume
      // single-recipient deduplication replaces our own delivery ledger.
    },
    body: JSON.stringify({
      sender: { email: email.from.trim().toLowerCase(), name: "Gencouv Capital" },
      to: [{ email: email.to.trim().toLowerCase() }],
      subject: email.subject.trim(),
      textContent: email.text.trim(),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Do not leak provider errors, credentials or recipient information.
    throw new Error("Brevo rejected the email request (HTTP " + response.status + ").");
  }
  const data: unknown = await response.json().catch(() => null);
  const messageId = data && typeof data === "object" && "messageId" in data &&
    typeof data.messageId === "string" ? data.messageId : null;
  return { provider: "brevo", messageId };
}
