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
      for (const email of emails) records.push({ email: email.trim().toLowerCase(), full_name: "", company_name: "" });
    }
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer", dense: true, sheetRows: GENCOUV_MAX_IMPORT + 2 });
    if (workbook.SheetNames.length > 5) throw new Error("Use at most five worksheets per import.");
    for (const sheet of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheet];
      const range = worksheet["!fullref"] || worksheet["!ref"];
      if (range && XLSX.utils.decode_range(range).e.r > GENCOUV_MAX_IMPORT) throw new Error("This worksheet exceeds 500 rows. Split the document; no rows were imported.");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
      for (const row of rows) {
        const mapped = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim().replace(/[ _-]/g, ""), value]));
        records.push({ email: String(mapped.email || mapped.emailaddress || mapped.workemail || mapped.businessemail || "").trim().toLowerCase(),
          full_name: String(mapped.fullname || mapped.name || [mapped.firstname, mapped.lastname].filter(Boolean).join(" ")).trim().slice(0, 200), company_name: String(mapped.company || mapped.companyname || "").trim().slice(0, 200) });
      }
    }
  }
  const seen = new Set<string>(); const contacts: typeof records = []; let duplicatesInFile = 0;
  for (const row of records) {
    if (!emailPattern.test(row.email) || row.email.length > 254) { invalid++; continue; }
    if (seen.has(row.email)) { duplicatesInFile++; continue; }
    seen.add(row.email); contacts.push(row);
  }
  if (contacts.length > GENCOUV_MAX_IMPORT) throw new Error("Import at most 500 unique contacts per document.");
  if (!contacts.length) throw new Error("No valid email addresses found. Spreadsheets need an Email column.");
  return { contacts, invalid, duplicatesInFile };
}
