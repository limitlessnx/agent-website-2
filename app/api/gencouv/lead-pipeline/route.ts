import { NextResponse } from "next/server";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const GENCOUV_ORG_ID = "05737e03-f8f0-4202-8e9b-0a8982a1091c";
const CAMPAIGN_KEY = "gencouv_long_form_copy_trading";
const TIMEZONE = "America/New_York";

type CandidateLead = Record<string, unknown>;

const ROLE_PREFIXES = new Set([
  "admin",
  "billing",
  "careers",
  "contact",
  "hello",
  "hr",
  "info",
  "jobs",
  "no-reply",
  "noreply",
  "office",
  "recruiting",
  "sales",
  "support",
  "team",
]);

const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "maildrop.cc",
  "mailinator.com",
  "mintemail.com",
  "mohmal.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "trashmail.com",
  "yopmail.com",
]);

const TYPO_DOMAINS = new Set([
  "gmai.com",
  "gmail.co",
  "gmail.con",
  "gmial.com",
  "hotmai.com",
  "hotnail.com",
  "icloud.con",
  "outllook.com",
  "outlok.com",
  "yaho.com",
  "yahooo.com",
]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

function todayInTimezone() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeEmail(value: unknown) {
  return lower(value).replace(/^mailto:/i, "").replace(/\s+/g, "");
}

function validEmail(email: string) {
  if (!email || email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,63}$/i.test(email);
}

function pick(lead: CandidateLead, ...keys: string[]) {
  for (const key of keys) {
    const value = lead[key];
    if (Array.isArray(value)) {
      const found = value.map(clean).find(Boolean);
      if (found) return found;
    }
    const cleaned = clean(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstName(fullName: string, lead: CandidateLead) {
  return pick(lead, "first_name", "firstName") || fullName.split(/\s+/)[0] || "";
}

function sourceId(lead: CandidateLead, email: string) {
  return pick(lead, "source_id", "lead_id", "id", "linkedin_url", "linkedinUrl", "profileUrl") || email;
}

function extractLead(lead: CandidateLead, cohortDate: string) {
  const email = normalizeEmail(pick(lead, "email", "Email", "workEmail", "businessEmail", "email address"));
  const fullName = pick(lead, "full_name", "fullName", "name");
  const source = pick(lead, "source") || "n8n";
  return {
    organization_id: GENCOUV_ORG_ID,
    source,
    source_id: sourceId(lead, email),
    audience_id: pick(lead, "audience_id", "audienceId"),
    audience_name: pick(lead, "audience_name", "audienceName"),
    cohort_date: cohortDate,
    full_name: fullName,
    first_name: firstName(fullName, lead),
    last_name: pick(lead, "last_name", "lastName"),
    job_title: pick(lead, "job_title", "jobTitle", "title", "position"),
    company: pick(lead, "company", "company_name", "companyName"),
    company_size: pick(lead, "company_size", "companySize"),
    company_size_max_detected: numberValue(lead.company_size_max_detected || lead.companySizeMaxDetected),
    industry: pick(lead, "industry"),
    location: pick(lead, "location"),
    country: pick(lead, "country"),
    email,
    normalized_email: email || null,
    phone: pick(lead, "phone", "phone_number", "phoneNumber"),
    linkedin_url: pick(lead, "linkedin_url", "linkedinUrl", "profileUrl"),
    website: pick(lead, "website", "companyWebsite"),
    product_interest: pick(lead, "product_interest", "interest") || "copy_trading",
    broker: pick(lead, "broker"),
    quality_score: Math.max(0, Math.min(100, numberValue(lead.quality_score || lead.score))),
    validation_status: "pending",
    qualification_status: "pending",
    campaign_status: "raw",
    payload: lead,
  };
}

async function getSettings() {
  const rows = await supabaseServerRequest<any[]>(
    `gencouv_campaign_settings?organization_id=eq.${GENCOUV_ORG_ID}&campaign_key=eq.${CAMPAIGN_KEY}&select=*&limit=1`,
  ).catch(() => []);
  return rows[0] || {
    daily_new_lead_limit: 30,
    daily_send_limit: 10,
    sending_enabled: false,
    timezone: TIMEZONE,
  };
}

async function existingEmail(email: string) {
  const encoded = encodeURIComponent(email);
  const [qualified, enrollments, suppressed, rejected] = await Promise.all([
    supabaseServerRequest<any[]>(`gencouv_qualified_leads?organization_id=eq.${GENCOUV_ORG_ID}&normalized_email=eq.${encoded}&select=id&limit=1`).catch(() => []),
    supabaseServerRequest<any[]>(`gencouv_campaign_enrollments?organization_id=eq.${GENCOUV_ORG_ID}&normalized_email=eq.${encoded}&select=id,campaign_status,do_not_contact,stop_reason&limit=1`).catch(() => []),
    supabaseServerRequest<any[]>(`gencouv_suppression_list?organization_id=eq.${GENCOUV_ORG_ID}&normalized_email=eq.${encoded}&select=id,reason&limit=1`).catch(() => []),
    supabaseServerRequest<any[]>(`gencouv_rejected_leads?organization_id=eq.${GENCOUV_ORG_ID}&normalized_email=eq.${encoded}&select=id,rejection_reason&limit=1`).catch(() => []),
  ]);
  return { qualified: qualified[0], enrollment: enrollments[0], suppressed: suppressed[0], rejected: rejected[0] };
}

function validateLead(lead: ReturnType<typeof extractLead>, existing: Awaited<ReturnType<typeof existingEmail>>) {
  const reasons: string[] = [];
  const email = lead.email || "";
  const [prefix, domain] = email.split("@");
  const profileText = [lead.job_title, lead.company, lead.industry, lead.payload && JSON.stringify(lead.payload)].join(" ").toLowerCase();

  if (!validEmail(email)) reasons.push("missing_or_invalid_email");
  if (ROLE_PREFIXES.has(prefix)) reasons.push("role_address_blocked");
  if (DISPOSABLE_DOMAINS.has(domain)) reasons.push("disposable_domain");
  if (TYPO_DOMAINS.has(domain)) reasons.push("typo_domain");
  if (existing.suppressed) reasons.push(`suppressed:${existing.suppressed.reason || "suppression_list"}`);
  if (existing.qualified || existing.enrollment) reasons.push("duplicate_or_previously_enrolled");
  if (existing.enrollment?.do_not_contact) reasons.push("do_not_contact");
  if (existing.enrollment?.stop_reason) reasons.push(`previous_stop:${existing.enrollment.stop_reason}`);
  if (lead.company_size_max_detected && lead.company_size_max_detected > 200) reasons.push("company_size_above_200");
  if (/founder|co-founder|chief executive|ceo|owner|chairman|president/i.test(profileText)) reasons.push("excluded_seniority");
  if (/forex trader|crypto trader|day trader|prop firm|funded trader|signal provider|trading educator|technical analyst|market analyst/i.test(profileText)) {
    reasons.push("trading_heavy_profile");
  }
  if ((lead.payload as Record<string, unknown>)?.mx_record_found === false) reasons.push("mx_check_failed");

  return [...new Set(reasons)];
}

async function insertRejected(lead: ReturnType<typeof extractLead>, reasons: string[]) {
  await supabaseServerRequest("gencouv_rejected_leads", {
    method: "POST",
    body: JSON.stringify({
      organization_id: GENCOUV_ORG_ID,
      source: lead.source,
      source_id: lead.source_id,
      lead_id: lead.source_id,
      email: lead.email || null,
      normalized_email: lead.email || null,
      rejection_reason: reasons.join(", "),
      validation_result: "rejected",
      processing_status: "rejected",
      payload: lead.payload,
    }),
  }).catch(() => undefined);
}

async function countEnrollmentsToday(cohortDate: string) {
  const rows = await supabaseServerRequest<any[]>(
    `gencouv_campaign_enrollments?organization_id=eq.${GENCOUV_ORG_ID}&campaign_key=eq.${CAMPAIGN_KEY}&cohort_date=eq.${cohortDate}&select=id&limit=1000`,
  ).catch(() => []);
  return rows.length;
}

async function refreshCohort(cohortDate: string, dailyLimit: number) {
  const [raw, rejected, qualified, enrolled] = await Promise.all([
    supabaseServerRequest<any[]>(`gencouv_raw_leads?organization_id=eq.${GENCOUV_ORG_ID}&cohort_date=eq.${cohortDate}&select=id&limit=10000`).catch(() => []),
    supabaseServerRequest<any[]>(`gencouv_rejected_leads?organization_id=eq.${GENCOUV_ORG_ID}&created_at=gte.${cohortDate}T00:00:00Z&select=id&limit=10000`).catch(() => []),
    supabaseServerRequest<any[]>(`gencouv_qualified_leads?organization_id=eq.${GENCOUV_ORG_ID}&cohort_date=eq.${cohortDate}&select=id&limit=10000`).catch(() => []),
    supabaseServerRequest<any[]>(`gencouv_campaign_enrollments?organization_id=eq.${GENCOUV_ORG_ID}&campaign_key=eq.${CAMPAIGN_KEY}&cohort_date=eq.${cohortDate}&select=id&limit=10000`).catch(() => []),
  ]);

  await supabaseServerRequest(`gencouv_daily_cohorts?on_conflict=organization_id,cohort_date,campaign_key`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      organization_id: GENCOUV_ORG_ID,
      cohort_date: cohortDate,
      campaign_key: CAMPAIGN_KEY,
      daily_new_lead_limit: dailyLimit,
      raw_generated: raw.length,
      rejected: rejected.length,
      qualified: qualified.length,
      campaign_enrolled: enrolled.length,
      status: enrolled.length >= dailyLimit ? "filled" : "open",
      timezone: TIMEZONE,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function authorize(request: Request) {
  const expected = process.env.GENCOUV_DASHBOARD_SECRET || process.env.GENCOUV_EMAIL_EVENT_SECRET || "";
  const provided = request.headers.get("x-gencouv-dashboard-secret") || request.headers.get("x-gencouv-event-secret") || "";
  return Boolean(expected && provided && expected === provided);
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const leads = Array.isArray(body.leads) ? body.leads : Array.isArray(body.items) ? body.items : [];
  const dryRun = body.dry_run !== false;
  const cohortDate = clean(body.cohort_date) || todayInTimezone();
  const settings = await getSettings();
  const dailyLimit = Math.max(1, Math.min(30, Number(body.daily_new_lead_limit || settings.daily_new_lead_limit || 30)));

  const summary = {
    raw_received: leads.length,
    raw_stored: 0,
    rejected: 0,
    qualified: 0,
    enrolled_reserved: 0,
    duplicates: 0,
    dry_run: dryRun,
    sending_enabled: Boolean(settings.sending_enabled),
    cohort_date: cohortDate,
    daily_new_lead_limit: dailyLimit,
    ready_for_resend: [] as Array<Record<string, unknown>>,
    rejected_samples: [] as Array<Record<string, unknown>>,
  };

  let enrolledToday = await countEnrollmentsToday(cohortDate);

  for (const raw of leads) {
    const lead = extractLead(raw, cohortDate);
    const insertedRaw = await supabaseServerRequest<any[]>("gencouv_raw_leads", {
      method: "POST",
      body: JSON.stringify(lead),
    }).catch(() => []);
    const rawRow = insertedRaw[0];
    if (rawRow?.id) summary.raw_stored += 1;

    const existing = lead.email ? await existingEmail(lead.email) : { qualified: null, enrollment: null, suppressed: null, rejected: null };
    const reasons = validateLead(lead, existing);
    if (reasons.includes("duplicate_or_previously_enrolled")) summary.duplicates += 1;

    if (reasons.length) {
      summary.rejected += 1;
      if (!dryRun) await insertRejected(lead, reasons);
      if (summary.rejected_samples.length < 10) {
        summary.rejected_samples.push({ email: lead.email, reason: reasons.join(", ") });
      }
      if (rawRow?.id) {
        await supabaseServerRequest(`gencouv_raw_leads?id=eq.${rawRow.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            validation_status: "rejected",
            qualification_status: "rejected",
            campaign_status: "rejected",
            rejection_reason: reasons.join(", "),
            updated_at: new Date().toISOString(),
          }),
        }).catch(() => undefined);
      }
      continue;
    }

    summary.qualified += 1;

    if (!dryRun) {
      await supabaseServerRequest("gencouv_qualified_leads?on_conflict=organization_id,normalized_email", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          ...lead,
          raw_lead_id: rawRow?.id || null,
          email: lead.email,
          normalized_email: lead.email,
          validation_status: "valid",
          qualification_status: "qualified",
          campaign_status: enrolledToday < dailyLimit ? "queued" : "qualified_waiting",
          email_sequence_status: "ready_not_started",
          metadata: { source_payload: lead.payload },
        }),
      });
    }

    if (enrolledToday >= dailyLimit) continue;

    enrolledToday += 1;
    summary.enrolled_reserved += 1;
    summary.ready_for_resend.push({
      email: lead.email,
      first_name: lead.first_name || "there",
      full_name: lead.full_name,
      company: lead.company,
      source: lead.source,
      audience_id: lead.audience_id,
      cohort_date: cohortDate,
      campaign_key: CAMPAIGN_KEY,
      event: "gencouv.lead.created",
      CTA_LINK: "https://t.me/Gencou_bot?start=email_campaign",
      sending_enabled: Boolean(settings.sending_enabled),
    });

    if (!dryRun) {
      await supabaseServerRequest("gencouv_campaign_enrollments?on_conflict=organization_id,normalized_email,campaign_key", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({
          organization_id: GENCOUV_ORG_ID,
          campaign_key: CAMPAIGN_KEY,
          lead_id: lead.source_id,
          normalized_email: lead.email,
          cohort_date: cohortDate,
          campaign_status: "queued",
          validation_status: "valid",
          qualification_status: "qualified",
          current_sequence_step: 0,
          metadata: {
            full_name: lead.full_name,
            company: lead.company,
            source: lead.source,
            audience_id: lead.audience_id,
            sending_enabled: Boolean(settings.sending_enabled),
          },
        }),
      });
    }
  }

  if (!dryRun) await refreshCohort(cohortDate, dailyLimit);

  return NextResponse.json({ success: true, ...summary });
}
