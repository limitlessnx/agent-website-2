import { createAdminClient } from "@/lib/supabase/admin";

type DateField = "birthday" | "anniversary";
type CapturedDate = { field: DateField; value: string };

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

function dateValue(month: number, day: number, year?: number): string | null {
  // A leap-safe anchor year keeps month/day matching independent of birth year.
  const y = year ?? 2000;
  const date = new Date(Date.UTC(y, month - 1, day));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseExplicitDate(text: string): string | null {
  const normalized = text.toLowerCase().replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
  // ISO dates are unambiguous.
  let match = normalized.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (match) return dateValue(Number(match[2]), Number(match[3]), Number(match[1]));

  // Month name followed by day, optionally with a year.
  match = normalized.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/);
  if (match) return dateValue(MONTHS[match[1]], Number(match[2]), match[3] ? Number(match[3]) : undefined);

  // Day followed by month name, optionally with a year.
  match = normalized.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?:\s+(\d{4}))?\b/);
  if (match) return dateValue(MONTHS[match[2]], Number(match[1]), match[3] ? Number(match[3]) : undefined);

  return null;
}

export function extractExplicitContactDates(message: string): CapturedDate[] {
  const text = message.trim();
  if (!text) return [];
  const found: CapturedDate[] = [];
  const patterns: Array<{ field: DateField; regex: RegExp }> = [
    { field: "birthday", regex: /\b(?:my|the|his|her|their)?\s*(?:birthday|date of birth|dob|born on)\b[^\n.!?]{0,50}/i },
    { field: "anniversary", regex: /\b(?:our|my|their|wedding|marriage)?\s*(?:wedding anniversary|marriage anniversary|anniversary)\b[^\n.!?]{0,50}/i },
  ];
  for (const { field, regex } of patterns) {
    const label = text.match(regex);
    if (!label) continue;
    const value = parseExplicitDate(label[0]);
    if (value) found.push({ field, value });
  }
  return found.filter((item, index, all) => all.findIndex((candidate) => candidate.field === item.field) === index);
}

export async function captureTenantContactDates(input: {
  organizationId: string;
  fullName: string;
  phone: string;
  message: string;
}) {
  const dates = extractExplicitContactDates(input.message);
  if (!dates.length || !input.organizationId || !input.phone) return { captured: [], reason: "no_explicit_date" };

  const admin = createAdminClient();
  const phone = input.phone.replace(/\D/g, "");
  if (phone.length < 7 || phone.length > 15) return { captured: [], reason: "invalid_phone" };

  const { data: existing, error: lookupError } = await admin
    .from("tenant_customer_contacts")
    .select("id,full_name,birthday,anniversary")
    .eq("organization_id", input.organizationId)
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const captured: Array<{ field: DateField; value: string }> = [];
  for (const item of dates) {
    // Never silently replace a date the client or tenant already supplied.
    if (existing && existing[item.field]) continue;
    patch[item.field] = item.value;
    captured.push(item);
  }
  if (!captured.length) return { captured: [], reason: "date_already_present" };

  if (existing?.id) {
    const { error } = await admin.from("tenant_customer_contacts").update(patch)
      .eq("organization_id", input.organizationId).eq("id", existing.id);
    if (error) throw error;
  } else {
    const row: Record<string, unknown> = {
      organization_id: input.organizationId,
      full_name: input.fullName.trim().slice(0, 180) || "WhatsApp customer",
      phone,
      source: "whatsapp_conversation",
      whatsapp_consent: "unknown",
      email_consent: "unknown",
      tags: [],
      notes: "",
      ...Object.fromEntries(captured.map((item) => [item.field, item.value])),
    };
    const { error } = await admin.from("tenant_customer_contacts").insert(row);
    if (error?.code === "23505") {
      // A concurrent inbound message may have created the same contact. Re-read,
      // then only fill missing dates, preserving existing values.
      const { data: raced, error: racedError } = await admin.from("tenant_customer_contacts")
        .select("id,birthday,anniversary").eq("organization_id", input.organizationId).or(`phone.eq.${phone},phone.eq.+${phone}`).maybeSingle();
      if (racedError) throw racedError;
      if (!raced?.id) throw error;
      const safePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const safeCaptured: typeof captured = [];
      for (const item of captured) {
        if (!raced[item.field]) { safePatch[item.field] = item.value; safeCaptured.push(item); }
      }
      if (safeCaptured.length) {
        const { error: updateError } = await admin.from("tenant_customer_contacts").update(safePatch)
          .eq("organization_id", input.organizationId).eq("id", raced.id);
        if (updateError) throw updateError;
      }
      return { captured: safeCaptured, reason: safeCaptured.length ? "captured_after_race" : "date_already_present" };
    }
    if (error) throw error;
  }
  return { captured, reason: "captured" };
}
