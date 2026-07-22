"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { uploadPropertyImagesToDrive } from "@/lib/google-drive";
import { getAdminSession } from "@/lib/admin-auth";
import { createLead, createProperty, importLeads, updatePropertyImageLink, type Lead } from "@/lib/limitless-data";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard");
}

export async function createLeadAction(formData: FormData) {
  await requireAdmin();
  await createLead({
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    status: String(formData.get("status") || "new"),
    score: String(formData.get("score") || "unscored"),
    budget: String(formData.get("budget") || ""),
    location_preference: String(formData.get("location_preference") || ""),
    property_type: String(formData.get("property_type") || ""),
    purpose: String(formData.get("purpose") || ""),
  });
  revalidatePath("/dashboard/limitless/leads");
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

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return "";
}

function parseLeadImport(text: string): Partial<Lead>[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rows.length) return [];

  const firstRow = parseCsvLine(rows[0]);
  const hasHeader = firstRow.some((cell) => /name|phone|whatsapp|budget|location|status|score/i.test(cell));
  const headers = hasHeader
    ? firstRow.map(normalizeHeader)
    : ["name", "phone", "budget", "location_preference", "property_type", "purpose", "status", "score"];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
    return {
      name: pick(row, ["name", "full_name", "client_name", "customer_name"]) || "Unknown",
      phone: pick(row, ["phone", "whatsapp", "whatsapp_phone", "mobile", "number", "contact"]),
      budget: pick(row, ["budget", "price_range", "price"]),
      location_preference: pick(row, ["location_preference", "preferred_location", "location", "area"]),
      property_type: pick(row, ["property_type", "type"]),
      purpose: pick(row, ["purpose", "interest"]),
      status: pick(row, ["status", "lead_status"]) || "new",
      score: pick(row, ["score", "lead_score"]) || "unscored",
    };
  });
}

export async function importLeadsAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("contacts_file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Upload a CSV contact file first.");
  }

  const text = await file.text();
  const result = await importLeads(parseLeadImport(text));
  revalidatePath("/dashboard/limitless/leads");
  revalidatePath("/dashboard");
  redirect(`/dashboard/limitless/leads?imported=${result.imported}&skipped=${result.skipped}&errors=${result.errors.length}`);
}

export async function createPropertyAction(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") || "");
  const created = await createProperty({
    title,
    location_area: String(formData.get("location_area") || ""),
    location_city: String(formData.get("location_city") || ""),
    price: String(formData.get("price") || ""),
    type: String(formData.get("type") || ""),
    status: String(formData.get("status") || "active"),
    drive_brochure_link: String(formData.get("drive_brochure_link") || ""),
    features: String(formData.get("features") || ""),
    description: String(formData.get("description") || ""),
  });
  const files = formData.getAll("property_images").filter((value): value is File => value instanceof File && value.size > 0);
  const propertyId = created[0]?.id;

  if (files.length && propertyId) {
    const driveLink = await uploadPropertyImagesToDrive(title || created[0].title, files);
    await updatePropertyImageLink(propertyId, driveLink);
  }

  revalidatePath("/dashboard/limitless/properties");
  revalidatePath("/dashboard/limitless/media");
  revalidatePath("/dashboard");
}

export async function uploadPropertyImagesAction(formData: FormData) {
  await requireAdmin();
  const propertyId = String(formData.get("property_id") || "");
  const propertyTitle = String(formData.get("property_title") || "Property");
  const files = formData.getAll("property_images").filter((value): value is File => value instanceof File && value.size > 0);

  if (!propertyId) throw new Error("Choose a property before uploading images.");
  if (!files.length) throw new Error("Choose at least one image.");

  const driveLink = await uploadPropertyImagesToDrive(propertyTitle, files);
  await updatePropertyImageLink(propertyId, driveLink);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/limitless/properties");
  revalidatePath("/dashboard/limitless/media");
}
