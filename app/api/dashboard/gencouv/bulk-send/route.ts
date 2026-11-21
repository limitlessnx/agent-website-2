import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { resendApi } from "@/lib/fluxknight-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const emailPattern = /^[^\\s@,;]+@[^\\s@,;]+\\.[^\\s@,;]+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const senders = new Set(["info@gencouv.com", "support@gencouv.com", "onboarding@gencouv.com"]);
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });
async function scope() {
  if (!(await getAdminSession())) return null;
  try { const result = await requireAdminSystemScope("gencouv"); return result.status === "unavailable" ? null : result.organizationId; }
  catch { return null; }
}
export async function POST(request: NextRequest) {
  const org = await scope();
  if (!org) return fail("Gencouv admin workspace required.", 403);
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("Invalid request origin.", 403);
  const input = await request.json().catch(() => null);
  if (!input || input.confirmed !== true || input.consent_confirmed !== true || input.mode !== "one_time") return fail("Confirm the one-time send and documented recipient consent.");
  const sender = String(input.from || "").trim().toLowerCase();
  const subject = String(input.subject || "").trim();
  const message = String(input.text || "").trim();
  const categoryId = String(input.category_id || "");
  const ids: unknown[] = Array.isArray(input.contact_ids) ? input.contact_ids : [];
  if (!senders.has(sender) || !subject || subject.length > 200 || !message || message.length > 30000) return fail("Valid sender, subject and message required.");
  if (ids.length < 1 || ids.length > 100 || ids.some(id => typeof id !== "string" || !uuid.test(id))) return fail("Choose 1–100 saved contacts per send.");
  if (new Set(ids).size !== ids.length) return fail("Duplicate contact selection.");
  if (categoryId && !uuid.test(categoryId)) return fail("Invalid category.");
  if (/\\[[^\\]\\n]{1,80}\\]/.test(subject)) return fail("Replace subject placeholders before sending.");
  const db = createAdminClient();
  const { data: contacts, error: contactError } = await db.from("crm_customers")
    .select("id,email,full_name,metadata,status").eq("organization_id", org).in("id", ids as string[]);
  if (contactError || !contacts || contacts.length !== ids.length) return fail("Some selected contacts could not be verified.", 503);
  if (categoryId) {
    const { data: assignments, error: assignmentError } = await db.from("crm_customer_category_assignments")
      .select("customer_id").eq("organization_id", org).eq("category_id", categoryId).in("customer_id", ids as string[]);
    if (assignmentError || assignments?.length !== ids.length) return fail("Selected contacts must belong to the chosen category.", 403);
  }
  const addresses = contacts.map(c => String(c.email || "").trim().toLowerCase());
  if (new Set(addresses).size !== addresses.length || addresses.some(email => !emailPattern.test(email))) return fail("Duplicate or invalid recipient address.");
  const { data: stopped, error: suppressionError } = await db.from("gencouv_suppression_list")
    .select("normalized_email").eq("organization_id", org).in("normalized_email", addresses);
  if (suppressionError) return fail("Suppression verification unavailable. Nothing sent.", 503);
  const blocked = new Set((stopped || []).map(s => String(s.normalized_email).toLowerCase()));
  if (contacts.some(c => {
    const consent = c.metadata && typeof c.metadata === "object" && !Array.isArray(c.metadata) ? String((c.metadata as Record<string, unknown>).marketing_consent || "") : "";
    return c.status === "blocked" || c.status === "archived" || consent !== "granted" || blocked.has(String(c.email).toLowerCase());
  })) return fail("One or more contacts lack recorded consent or are suppressed. Nothing sent.", 403);
  // This action never changes the automated campaign toggle and never enrolls contacts in sequences.
  const emails = contacts.map(c => ({
    from: "Gencouv <" + sender + ">", to: [String(c.email).trim().toLowerCase()],
    reply_to: sender, subject, text: message.replace(/\\[Name\\]/gi, String(c.full_name || "there"))
  }));
  try {
    const result = await resendApi("/emails/batch", { method: "POST", body: JSON.stringify(emails) });
    const receipts = Array.isArray(result.data) ? result.data : [];
    if (receipts.length !== emails.length) return NextResponse.json({ error: "Provider response incomplete. Check Resend before retrying to avoid duplicate emails.", provider_response: result }, { status: 502, headers });
    const now = new Date().toISOString();
    const rows = contacts.map((c, index) => ({
      organization_id: org, recipient_email: addresses[index], recipient_name: c.full_name,
      subject, status: "sent", provider: "resend", provider_email_id: receipts[index]?.id || null,
      sent_at: now, metadata: { source: "gencouv_manual_bulk_one_time", sender, contact_id: c.id, category_id: categoryId || null }
    }));
    const { error: ledgerError } = await db.from("gencouv_email_messages").insert(rows);
    return NextResponse.json({ accepted: emails.length, tracked: !ledgerError, note: ledgerError
      ? "Resend accepted the batch, but history recording failed. Do not retry before reconciling provider IDs."
      : "Resend accepted the one-time batch. Delivery is not yet confirmed." }, { status: 201, headers });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Resend batch request failed.", 502);
  }
}
