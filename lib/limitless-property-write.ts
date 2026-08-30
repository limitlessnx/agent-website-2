import type { PropertyRecord } from "@/lib/limitless-data";

const LIMITLESS_REALTY_ORGANIZATION_ID =
  process.env.LIMITLESS_REALTY_ORGANIZATION_ID || "b15f21b4-5697-4d21-9421-8a34eae3476d";

function supabaseConfig() {
  const url = (
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  return { url, key };
}

export function normalizePropertyPrice(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) throw new Error("Property price must be a valid positive number.");
    return input;
  }

  const raw = String(input).trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  let multiplier = 1;
  if (/\b(billion|bn)\b/.test(lower) || /\d\s*b\s*$/.test(lower)) multiplier = 1_000_000_000;
  else if (/\b(million|mn)\b/.test(lower) || /\d\s*m\s*$/.test(lower)) multiplier = 1_000_000;
  else if (/\b(thousand|k)\b/.test(lower)) multiplier = 1_000;

  const cleaned = lower
    .replace(/₦|ngn|naira/g, "")
    .replace(/billion|million|thousand|bn|mn/g, "")
    .replace(/[bmk]\s*$/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid property price: "${raw}". Use a number such as 104,000,000 or 104 million.`);
  }

  const value = Number(cleaned) * multiplier;
  if (!Number.isFinite(value) || value < 0) throw new Error("Property price must be a valid positive number.");
  return value;
}

export async function createPropertyNormalized(payload: Record<string, unknown>): Promise<PropertyRecord[]> {
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error("Supabase is not configured.");

  const body = {
    organization_id: LIMITLESS_REALTY_ORGANIZATION_ID,
    title: String(payload.title || "Untitled property"),
    location_area: String(payload.location_area || ""),
    location_city: String(payload.location_city || ""),
    price: normalizePropertyPrice(payload.price),
    type: String(payload.type || ""),
    status: String(payload.status || "active"),
    drive_photos_link: String(payload.drive_photos_link || ""),
    drive_brochure_link: String(payload.drive_brochure_link || ""),
    features: String(payload.features || ""),
    description: String(payload.description || ""),
  };

  const response = await fetch(`${url}/rest/v1/properties`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase properties request failed: ${response.status} ${detail}`.trim());
  }

  return (await response.json()) as PropertyRecord[];
}
