import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const allowed = new Set(["csv", "xlsx", "xls", "txt"]);
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;
const emailFinder = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const maxBytes = 2 * 1024 * 1024;
const maxContacts = 500;
const clean = (value: unknown) => String(value ?? "").trim();
const normalize = (value: unknown) => clean(value).toLowerCase();
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });
async function scope() {
  if (!(await getAdminSession())) return null;
  try {
    const result = await requireAdminSystemScope("gencouv");
    return result.status !== "unavailable" ? result.organizationId : null;
  } catch { return null; }
}
function parseContacts(buffer: Buffer, extension: string) {
  const records: Array<{ email: string; full_name: string; company_name: string }> = [];
  if (extension === "txt") {
    for (const line of buffer.toString("utf8").split(/\r?\n/)) {
      const emails = line.match(emailFinder) || [];
      for (const email of emails) records.push({ email: normalize(email), full_name: "", company_name: "" });
    }
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer", dense: true, sheetRows: maxContacts + 100 });
    for (const sheet of workbook.SheetNames.slice(0, 5)) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheet], { defval: "" });
      for (const row of rows) {
        const mapped = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim().replace(/[ _-]/g, ""), v]));
        const email = normalize(mapped.email || mapped.emailaddress || mapped.workemail || mapped.businessemail);
        if (!email) continue;
        records.push({
          email,
          full_name: clean(mapped.fullname || mapped.name || [mapped.firstname, mapped.lastname].filter(Boolean).join(" ")).slice(0, 200),
          company_name: clean(mapped.company || mapped.companyname).slice(0, 200),
        });
      }
    }
  }
  const seen = new Set<string>();
  const unique: typeof records = [];
  let duplicatesInFile = 0, invalid = 0;
  for (const row of records) {
    if (!emailPattern.test(row.email) || row.email.length > 254) { invalid++; continue; }
    if (seen.has(row.email)) { duplicatesInFile++; continue; }
    seen.add(row.email);
    unique.push(row);
  }
  return { contacts: unique, duplicatesInFile, invalid };
}

export async function GET() {
  const organizationId = await scope();
  if (!organizationId) return fail("Gencouv admin workspace required.", 403);
  const db = createAdminClient();
  const { data, error } = await db.from("crm_customers")
    .select("id,full_name,email,company_name,metadata,created_at")
    .eq("organization_id", organizationId)
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail("Could not load saved contacts.", 500);
  return NextResponse.json({ contacts: data || [] }, { headers });
}

export async function POST(request: NextRequest) {
  const organizationId = await scope();
  if (!organizationId) return fail("Gencouv admin workspace required.", 403);
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("Invalid request origin.", 403);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Select a document to import.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!allowed.has(extension)) return fail("Supported formats: CSV, XLSX, XLS, and TXT.");
  if (file.size < 1 || file.size > maxBytes) return fail("Files must be between 1 byte and 2 MB.");
  let parsed: ReturnType<typeof parseContacts>;
  try { parsed = parseContacts(Buffer.from(await file.arrayBuffer()), extension); }
  catch { return fail("Could not read this document. Check the file format."); }
  if (!parsed.contacts.length) return fail("No valid email addresses found. Use an Email column in spreadsheets.");
  if (parsed.contacts.length > maxContacts) return fail("Import at most 500 unique contacts per document.");
  const db = createAdminClient();
  const categoryId = clean(form?.get("category_id"));
  if (categoryId) {
    const { data, error } = await db.from("crm_lead_categories").select("id")
      .eq("organization_id", organizationId).eq("id", categoryId).maybeSingle();
    if (error || !data) return fail("Select a valid Gencouv category.");
  }
  const emails = parsed.contacts.map(c => c.email);
  const { data: existing, error: lookupError } = await db.from("crm_customers")
    .select("id,email").eq("organization_id", organizationId).in("email", emails);
  if (lookupError) return fail("Unable to check existing contacts.", 500);
  const found = new Map((existing || []).map(row => [normalize(row.email), row.id]));
  const fresh = parsed.contacts.filter(c => !found.has(c.email));
  const preview = form?.get("preview") !== "false";
  if (preview) return NextResponse.json({
    preview: true, total: parsed.contacts.length, new_contacts: fresh.length,
    existing_contacts: parsed.contacts.length - fresh.length,
    duplicates_in_file: parsed.duplicatesInFile, invalid: parsed.invalid,
    sample: parsed.contacts.slice(0, 10)
  }, { headers });
  // No marketing consent is inferred from a document upload, and no campaign is enrolled.
  const savedIds: string[] = [];
  let skipped = parsed.contacts.length - fresh.length;
  let failed = 0;
  for (const contact of fresh) {
    const { data, error } = await db.from("crm_customers").insert({
      organization_id: organizationId, full_name: contact.full_name || null,
      email: contact.email, company_name: contact.company_name || null,
      metadata: { source: "gencouv_document_import", import_filename: file.name.slice(0, 180), marketing_consent: "unknown", imported_at: new Date().toISOString() }
    }).select("id").single();
    if (error || !data) { failed++; continue; }
    savedIds.push(data.id);
  }
  if (categoryId) {
    const ids = [...savedIds, ...Array.from(found.values())];
    for (const id of ids) {
      const { error } = await db.from("crm_customer_category_assignments")
        .upsert({ organization_id: organizationId, customer_id: id, category_id: categoryId },
          { onConflict: "organization_id,customer_id,category_id", ignoreDuplicates: true });
      if (error) failed++;
    }
  }
  return NextResponse.json({
    success: failed === 0, imported: savedIds.length, already_saved: skipped,
    failed, duplicates_in_file: parsed.duplicatesInFile,
    message: "Contacts saved for review. No marketing emails have been sent or scheduled."
  }, { status: failed ? 207 : 200, headers });
}
