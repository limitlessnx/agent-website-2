import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders, GENCOUV_UUID, GencouvRequestError } from "@/lib/gencouv-admin";
import { parseGencouvContacts, GENCOUV_IMPORT_BYTES } from "@/lib/gencouv-contact-import";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { db, organizationId } = await requireGencouvAdmin();
    const [contacts, history] = await Promise.all([
      db.from("crm_customers").select("id,full_name,email,company_name,metadata,created_at").eq("organization_id", organizationId).not("email", "is", null).order("created_at", { ascending: false }).limit(100),
      db.from("gencouv_sync_runs").select("id,status,records_read,records_written,metadata,started_at,completed_at").eq("organization_id", organizationId).eq("source", "dashboard").eq("metadata->>import_kind", "document_import").order("started_at", { ascending: false }).limit(20),
    ]);
    if (contacts.error) throw contacts.error;
    return NextResponse.json({ contacts: contacts.data || [], history: history.error ? null : history.data || [], history_unavailable: Boolean(history.error) }, { headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
export async function POST(request: Request) {
  try {
    const { db, organizationId, session } = await requireGencouvAdmin(request);
    const form = await request.formData().catch(() => null); const file = form?.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > GENCOUV_IMPORT_BYTES) throw new GencouvRequestError("Select a CSV, Excel or TXT document of up to 2 MB.");
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["csv", "xlsx", "xls", "txt"].includes(extension)) throw new GencouvRequestError("Supported formats: CSV, XLSX, XLS and TXT.");
    const bytes = Buffer.from(await file.arrayBuffer());
    let parsed: ReturnType<typeof parseGencouvContacts>;
    try { parsed = parseGencouvContacts(bytes, extension); } catch (error) { throw new GencouvRequestError(error instanceof Error ? error.message : "The document could not be parsed."); }
    const categoryId = String(form?.get("category_id") || "");const batchId = String(form?.get("batch_id") || "");
    if (!GENCOUV_UUID.test(batchId) || categoryId && !GENCOUV_UUID.test(categoryId)) throw new GencouvRequestError("Reload the import form and select a valid category.");
    if (categoryId) {
      const category = await db.from("crm_lead_categories").select("id").eq("organization_id", organizationId).eq("id", categoryId).maybeSingle();
      if (category.error || !category.data) throw new GencouvRequestError("Category not found in Gencouv.");
    }
    const consent = form?.get("consent_confirmed") === "true";const consentSource = String(form?.get("consent_source") || "").trim();
    if (consent && (consentSource.length < 8 || consentSource.length > 300)) throw new GencouvRequestError("Document the actual permission source in 8–300 characters. Publicly collected addresses are not an opt-in.");
    const emails = parsed.contacts.map(contact => contact.email); let existingCount = 0;
    for (let offset = 0; offset < emails.length; offset += 75) {
      // Canonical CRM has a case-insensitive email uniqueness index. ILIKE checks
      // legacy mixed-case rows too; the transaction repeats this lookup at commit.
      const clauses = emails.slice(offset, offset + 75).map(email => `email.ilike.${JSON.stringify(email.replace(/[%_]/g, value => `\\${value}`))}`).join(",");
      const existing = await db.from("crm_customers").select("id,email").eq("organization_id", organizationId).or(clauses);
      if (existing.error) throw existing.error;
      existingCount += existing.data?.length || 0;
    }
    if (form?.get("preview") !== "false") return NextResponse.json({ preview: true, total: parsed.contacts.length, new_contacts: parsed.contacts.length - existingCount, existing_contacts: existingCount, duplicates_in_file: parsed.duplicatesInFile, invalid: parsed.invalid, named_contacts: parsed.namedContacts, unnamed_contacts: parsed.contacts.length - parsed.namedContacts, sample: parsed.contacts.slice(0, 10) }, { headers: gencouvPrivateHeaders });
    const hash = createHash("sha256").update(bytes).update(JSON.stringify({ categoryId, consent, consentSource })).digest("hex");
    const saved = await db.rpc("gencouv_import_contacts", { p_organization_id: organizationId, p_batch_id: batchId, p_hash: hash, p_contacts: parsed.contacts, p_category_id: categoryId || null, p_consent: consent, p_consent_source: consentSource, p_filename: file.name, p_actor: session.email });
    if (saved.error || !saved.data) throw new GencouvRequestError("The reviewed import could not be committed. Retry the same document; no partial import was confirmed.", 503);
    return NextResponse.json({ success: true, ...saved.data, duplicates_in_file: parsed.duplicatesInFile, invalid: parsed.invalid, message: "Contacts and import history saved. No email sent or campaign enrollment created." }, { headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
