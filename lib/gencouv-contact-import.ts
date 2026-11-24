import { TextDecoder } from "node:util";
import { cleanGencouvContactName } from "@/lib/gencouv-personalization";
import * as XLSX from "xlsx";
export const GENCOUV_MAX_IMPORT = 500;
export const GENCOUV_IMPORT_BYTES = 2 * 1024 * 1024;
const emailPattern = /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i;
export function parseGencouvContacts(buffer: Buffer, extension: string) {
  const records: Array<{ email: string; full_name: string; company_name: string }> = [];
  let invalid = 0;
  if (extension === "txt") {
    for (const line of buffer.toString("utf8").split(/\r?\n/).filter(value => value.trim())) {
      const emails = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      if (!emails.length) invalid++;
      // A name can be associated only when the line identifies one address.
      let fullName = "";
      if (emails.length === 1) {
        const candidate = line.replace(emails[0], "").replace(/[<>]/g, "").replace(/^[\s,;|–—-]+|[\s,;|–—-]+$/gu, "").replace(/^"(.*)"$/, "$1");
        if (/^[\p{L}\p{M}\s.'’(),-]+$/u.test(candidate)) fullName = cleanGencouvContactName(candidate);
      }
      for (const email of emails) records.push({ email: email.trim().toLowerCase(), full_name: fullName, company_name: "" });
    }
  } else {
    let source: Buffer | string = buffer;
    if (extension === "csv") {
      try { source = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
      catch { source = new TextDecoder("windows-1252").decode(buffer); }
    }
    const workbook = XLSX.read(source, { type: typeof source === "string" ? "string" : "buffer", dense: true, sheetRows: GENCOUV_MAX_IMPORT + 2 });
    if (workbook.SheetNames.length > 5) throw new Error("Use at most five worksheets per import.");
    for (const sheet of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheet];
      const range = worksheet["!fullref"] || worksheet["!ref"];
      if (range && XLSX.utils.decode_range(range).e.r > GENCOUV_MAX_IMPORT) throw new Error("This worksheet exceeds 500 rows. Split the document; no rows were imported.");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
      for (const row of rows) {
        const mapped = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim().replace(/[^a-z0-9]/g, ""), value]));
        records.push({ email: String(mapped.email || mapped.emailaddress || mapped.workemail || mapped.businessemail || "").trim().toLowerCase(),
          full_name: cleanGencouvContactName(mapped.fullname) || cleanGencouvContactName(mapped.name) || cleanGencouvContactName(mapped.contactname) || cleanGencouvContactName(mapped.recipientname) || cleanGencouvContactName([mapped.firstname || mapped.givenname, mapped.middlename, mapped.lastname || mapped.surname || mapped.familyname].map(cleanGencouvContactName).filter(Boolean).join(" ")), company_name: String(mapped.company || mapped.companyname || "").trim().slice(0, 200) });
      }
    }
  }
  const seen = new Map<string, (typeof records)[number]>(); const contacts: typeof records = []; let duplicatesInFile = 0;
  for (const row of records) {
    if (!emailPattern.test(row.email) || row.email.length > 254) { invalid++; continue; }
    const prior = seen.get(row.email);
    if (prior) { duplicatesInFile++; if (!prior.full_name && row.full_name) prior.full_name = row.full_name; if (!prior.company_name && row.company_name) prior.company_name = row.company_name; continue; }
    seen.set(row.email, row); contacts.push(row);
  }
  if (contacts.length > GENCOUV_MAX_IMPORT) throw new Error("Import at most 500 unique contacts per document.");
  if (!contacts.length) throw new Error("No valid email addresses found. Spreadsheets need an Email column.");
  return { contacts, invalid, duplicatesInFile, namedContacts: contacts.filter(contact => contact.full_name).length };
}
