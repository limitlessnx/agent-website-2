import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { resendApi } from "@/lib/fluxknight-mail";
import { createGencouvUnsubscribeUrl } from "@/lib/gencouv-bulk-unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const senders = new Set(["info@gencouv.com", "support@gencouv.com", "onboarding@gencouv.com"]);
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });
type Candidate = { id: string; full_name: string | null; email: string; metadata: unknown; status: string };
type Job = { id: string; campaign_id: string; customer_id: string; organization_id: string; normalized_email: string; recipient_name: string | null };
type Campaign = { id: string; from_email: string; subject: string; text_body: string; organization_id: string };
function hasConsent(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const meta = value as Record<string, unknown>;
  // The campaign toggle attests to consent; it cannot grant it to contacts.
  return meta.marketing_consent === "granted" &&
    typeof (meta.marketing_consent_source ?? meta.consent_source) === "string" &&
    String(meta.marketing_consent_source ?? meta.consent_source).trim().length > 0;
}
async function scope() {
  if (!(await getAdminSession())) return null;
  try {
    const result = await requireAdminSystemScope("gencouv");
    return result.status !== "unavailable" ? result.organizationId : null;
  } catch { return null; }
}
async function suppress(db: ReturnType<typeof createAdminClient>, org: string, address: string) {
  return db.from("gencouv_suppression_list").select("id")
    .eq("organization_id", org).eq("normalized_email", address).limit(1);
}

export async function GET() {
  const org = await scope();
  if (!org) return fail("Gencouv admin workspace required.", 403);
  const db = createAdminClient();
  const { data, error } = await db.from("gencouv_bulk_campaigns")
    .select("id,subject,status,created_at,consent_confirmed_at")
    .eq("organization_id", org).order("created_at", { ascending: false }).limit(20);
  if (error) return fail("Bulk campaign storage is not available yet.", 503);
  return NextResponse.json({ campaigns: data ?? [], sending_enabled: process.env.GENCOUV_BULK_SEND_ENABLED === "true" }, { headers });
}

export async function POST(request: NextRequest) {
  const org = await scope();
  if (!org) return fail("Gencouv admin workspace required.", 403);
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("Invalid request origin.", 403);
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return fail("Invalid campaign request.");
  const action = input.action;
  const db = createAdminClient();

  if (action === "create") {
    const campaignId = String(input.campaign_id || "");
    const categoryId = String(input.category_id || "");
    const from = String(input.from || "").trim().toLowerCase();
    const subject = String(input.subject || "").trim();
    const text = String(input.text || "").trim();
    const basis = String(input.consent_basis || "").trim();
    if (!uuid.test(campaignId) || (categoryId && !uuid.test(categoryId)) ||
        !senders.has(from) || !subject || subject.length > 200 ||
        !text || text.length > 15000 || /\[[^\]\n]{1,80}\]/.test(subject + " " + text))
      return fail("Provide a valid sender, campaign, category and completed email.");
    if (input.consent_accepted !== "yes" || basis.length < 8 || basis.length > 300)
      return fail("Confirm prior recipient consent and record how it was obtained.", 403);
    if (categoryId) {
      const { data, error } = await db.from("crm_lead_categories").select("id")
        .eq("organization_id", org).eq("id", categoryId).maybeSingle();
      if (error || !data) return fail("Invalid Gencouv category.", 404);
    }
    let ids: string[] | null = null;
    if (categoryId) {
      const { data, error } = await db.from("crm_customer_category_assignments")
        .select("customer_id").eq("organization_id", org).eq("category_id", categoryId).limit(1001);
      if (error || (data?.length ?? 0) > 1000) return fail("Audience exceeds reviewed category limits.", 409);
      ids = (data ?? []).map(r => r.customer_id);
    }
    if (ids && ids.length === 0) return fail("No contacts in this category.", 409);
    let query = db.from("crm_customers").select("id,full_name,email,metadata,status")
      .eq("organization_id", org).not("email", "is", null).limit(501);
    if (ids) query = query.in("id", ids);
    const { data: rows, error: lookupError } = await query;
    if (lookupError) return fail("Contact lookup unavailable.", 503);
    if ((rows?.length ?? 0) > 500) return fail("Audience exceeds 500 contacts. Narrow the category.", 409);
    const contacts = (rows ?? []) as Candidate[];
    const emails = Array.from(new Set(contacts.map(c => String(c.email || "").trim().toLowerCase())
      .filter(email => emailPattern.test(email) && email.length <= 254)));
    const blocked = new Set<string>();
    for (let i = 0; i < emails.length; i += 75) {
      const { data, error } = await db.from("gencouv_suppression_list")
        .select("normalized_email").eq("organization_id", org)
        .in("normalized_email", emails.slice(i, i + 75));
      if (error) return fail("Suppression list unavailable.", 503);
      for (const item of data ?? []) blocked.add(item.normalized_email.toLowerCase());
    }
    const dedupe = new Set<string>();
    const eligible = contacts.filter(contact => {
      const email = String(contact.email || "").trim().toLowerCase();
      if (!emailPattern.test(email) || !hasConsent(contact.metadata) ||
          ["blocked","archived"].includes(contact.status) || blocked.has(email) || dedupe.has(email)) return false;
      dedupe.add(email);
      return true;
    });
    if (!eligible.length) return fail("No recipients have recorded marketing consent. The Yes toggle cannot override missing consent.", 409);
    const { error: draftError } = await db.from("gencouv_bulk_campaigns").insert({
      id: campaignId, organization_id: org, category_id: categoryId || null,
      from_email: from, subject, text_body: text, status: "draft",
      consent_confirmed: true, consent_basis: basis, consent_confirmed_at: new Date().toISOString()
    });
    if (draftError) return fail("Campaign ID already exists or storage is unavailable.", 409);
    const jobs = eligible.map(contact => ({
      campaign_id: campaignId, organization_id: org, customer_id: contact.id,
      normalized_email: contact.email.trim().toLowerCase(),
      recipient_name: contact.full_name, status: "queued"
    }));
    const { error: jobError } = await db.from("gencouv_bulk_recipients").insert(jobs);
    if (jobError) return fail("Audience reservation failed. Campaign remains inactive.", 503);
    const { error: readyError } = await db.from("gencouv_bulk_campaigns")
      .update({ status: "ready" }).eq("id", campaignId).eq("organization_id", org).eq("status", "draft");
    if (readyError) return fail("Campaign not ready; no emails were sent.", 503);
    return NextResponse.json({
      ok: true, campaign_id: campaignId, queued: jobs.length,
      excluded: contacts.length - jobs.length,
      note: "Campaign prepared. No emails sent. Select Send next batch when ready."
    }, { headers, status: 201 });
  }

  if (action === "send") {
    if (process.env.GENCOUV_BULK_SEND_ENABLED !== "true")
      return fail("Bulk sending is disabled until migration, consent, unsubscribe and delivery tests pass.", 503);
    if (!process.env.GENCOUV_UNSUBSCRIBE_SECRET || process.env.GENCOUV_UNSUBSCRIBE_SECRET.length < 32)
      return fail("Unsubscribe service is not configured.", 503);
    const campaignId = String(input.campaign_id || "");
    if (!uuid.test(campaignId)) return fail("Invalid campaign.");
    const { data: campaign, error: campaignError } = await db.from("gencouv_bulk_campaigns")
      .select("id,from_email,subject,text_body,organization_id")
      .eq("organization_id", org).eq("id", campaignId).eq("status", "ready").maybeSingle();
    if (campaignError || !campaign) return fail("Campaign not ready.", 409);
    const { data: claimed, error: claimError } = await db.rpc("gencouv_claim_bulk_batch", {
      p_organization_id: org, p_campaign_id: campaignId, p_requested: 10
    });
    if (claimError) return fail("Could not reserve a sending batch. No emails sent by this request.", 503);
    const jobs = (claimed ?? []) as Job[];
    let accepted = 0, suppressed = 0, uncertain = 0;
    for (const job of jobs) {
      try {
        // Recheck suppression and consent immediately before every provider request.
        const { data: contact, error: contactError } = await db.from("crm_customers")
          .select("id,email,metadata,status").eq("organization_id", org)
          .eq("id", job.customer_id).maybeSingle();
        const { data: stops, error: stopError } = await suppress(db, org, job.normalized_email);
        if (contactError || stopError) throw Error("Eligibility lookup failed");
        if (!contact || String(contact.email || "").trim().toLowerCase() !== job.normalized_email ||
            ["blocked","archived"].includes(contact.status) ||
            !hasConsent(contact.metadata) || (stops?.length ?? 0) > 0) {
          await db.from("gencouv_bulk_recipients").update({ status: "suppressed" })
            .eq("id", job.id).eq("organization_id", org).eq("status", "sending");
          suppressed++;
          continue;
        }
        const current = campaign as Campaign;
        const unsubscribe = createGencouvUnsubscribeUrl({ organizationId: org, email: job.normalized_email });
        const body = current.text_body + "\n\nTo stop marketing emails from Gencouv Capital, unsubscribe: " + unsubscribe;
        const response = await resendApi("/emails", {
          method: "POST",
          headers: { "Idempotency-Key": "gencouv-bulk-" + job.id },
          body: JSON.stringify({
            from: "Gencouv Capital <" + current.from_email + ">",
            to: [job.normalized_email], reply_to: current.from_email,
            subject: current.subject, text: body,
            headers: {
              "List-Unsubscribe": "<" + unsubscribe + ">",
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
            }
          })
        });
        const providerId = typeof response.id === "string" ? response.id : null;
        const { error: savedError } = await db.from("gencouv_bulk_recipients")
          .update({ status: "accepted", provider_email_id: providerId, sent_at: new Date().toISOString() })
          .eq("id", job.id).eq("organization_id", org).eq("status", "sending");
        if (savedError) throw Error("Provider accepted but delivery ledger write failed");
        await db.from("gencouv_email_messages").insert({
          organization_id: org, recipient_email: job.normalized_email,
          recipient_name: job.recipient_name, from_email: current.from_email,
          subject: current.subject, status: "sent", provider: "resend",
          provider_email_id: providerId, sent_at: new Date().toISOString(),
          metadata: { source: "gencouv_bulk_campaign", campaign_id: campaignId, recipient_job_id: job.id }
        });
        accepted++;
      } catch {
        // Network timeouts may occur AFTER provider acceptance: do not auto-retry.
        await db.from("gencouv_bulk_recipients").update({ status: "unknown", error_code: "verify_provider_before_retry" })
          .eq("id", job.id).eq("organization_id", org).eq("status", "sending");
        uncertain++;
      }
    }
    const { count: remaining, error: countError } = await db.from("gencouv_bulk_recipients")
      .select("id", { count: "exact", head: true }).eq("campaign_id", campaignId)
      .eq("organization_id", org).eq("status", "queued");
    return NextResponse.json({ ok: true, claimed: jobs.length, accepted, suppressed,
      uncertain, remaining: countError ? null : remaining,
      note: "Accepted means Resend accepted the request, not delivered to inbox. Unknown outcomes must be reconciled manually." }, { headers });
  }
  return fail("Unknown campaign action.");
}
