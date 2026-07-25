"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { getAdminSession } from "@/lib/admin-auth";
import {
  importProgressiveLeads,
  saveProgressiveLead,
  type ProgressiveLeadInput,
} from "@/lib/lead-profile-service";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard/limitless/leads");
}

export async function createProgressiveLeadAction(formData: FormData) {
  await requireAdmin();

  await saveProgressiveLead({
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim() || undefined,
    status: String(formData.get("status") || "new"),
    score: String(formData.get("score") || "").trim() || undefined,
    budget: String(formData.get("budget") || "").trim() || undefined,
    location_preference: String(formData.get("location_preference") || "").trim() || undefined,
    property_type: String(formData.get("property_type") || "").trim() || undefined,
    property_interest: String(formData.get("property_interest") || "").trim() || undefined,
    purpose: String(formData.get("purpose") || "").trim() || undefined,
    source: "admin_dashboard",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/limitless/leads");
  revalidatePath("/dashboard/limitless/campaigns");
  redirect("/dashboard/limitless/leads?saved=1");
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return "";
}

function mapRows(rows: string[][]): ProgressiveLeadInput[] {
  if (!rows.length) return [];

  const first = rows[0].map((cell) => String(cell || "").trim());
  const hasHeader = first.some((cell) => /name|phone|whatsapp|mobile|email|budget|location|interest|property/i.test(cell));
  const headers = hasHeader
    ? first.map(normalizeHeader)
    : ["name", "phone", "email", "budget", "location_preference", "property_type", "purpose", "status", "score"];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((cells) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, String(cells[index] || "").trim()]));
    return {
      name: pick(row, ["name", "full_name", "client_name", "customer_name"]),
      phone: pick(row, ["phone", "phone_number", "whatsapp", "whatsapp_phone", "mobile", "mobile_number", "number", "contact"]),
      email: pick(row, ["email", "email_address", "customer_email", "client_email", "contact_email"]) || undefined,
      budget: pick(row, ["budget", "price_range", "price"]) || undefined,
      location_preference: pick(row, ["location_preference", "preferred_location", "location", "state", "area"]) || undefined,
      property_type: pick(row, ["property_type", "type"]) || undefined,
      property_interest: pick(row, ["property_interest", "interested_property", "property_name", "estate"]) || undefined,
      purpose: pick(row, ["purpose", "interest"]) || undefined,
      status: pick(row, ["status", "lead_status"]) || "new",
      score: pick(row, ["score", "lead_score"]) || undefined,
      source: "admin_dashboard_import",
    };
  });
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

async function parseFile(file: File) {
  const filename = file.name.toLowerCase();
  if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
    return mapRows(rows.map((row) => row.map((cell) => String(cell || "").trim())).filter((row) => row.some(Boolean)));
  }

  const rows = (await file.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
  return mapRows(rows);
}

export async function importProgressiveLeadsAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("contacts_file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Upload a CSV or Excel contact file first.");

  const result = await importProgressiveLeads(await parseFile(file));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/limitless/leads");
  revalidatePath("/dashboard/limitless/campaigns");
  redirect(`/dashboard/limitless/leads?imported=${result.imported}&skipped=${result.skipped}&errors=${result.errors.length}`);
}
