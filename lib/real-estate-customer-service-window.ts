import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLeadPhone } from "@/lib/lead-profile-service";
import { resolveActiveRealEstateOrganization } from "@/lib/real-estate-organization";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function parseInboundTimestamp(value: unknown, receivedAt = Date.now()) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date(receivedAt).toISOString();
  const numeric = Number(raw);
  const parsed = Number.isFinite(numeric) && /^\d{10,13}$/.test(raw)
    ? new Date(raw.length === 10 ? numeric * 1000 : numeric).getTime()
    : Date.parse(raw);
  if (!Number.isFinite(parsed) || parsed > receivedAt + 5 * 60 * 1000) return new Date(receivedAt).toISOString();
  return new Date(parsed).toISOString();
}

export function isWithinCustomerServiceWindow(value: unknown, now = Date.now()) {
  const at = Date.parse(String(value ?? ""));
  return Number.isFinite(at) && at <= now && now - at < WINDOW_MS;
}

function normalizedPhone(value: unknown) {
  const phone = normalizeLeadPhone(String(value ?? ""));
  return /^[0-9]{8,15}$/.test(phone) ? phone : "";
}

export async function recordRealEstateCustomerInboundWindow(input: {
  organizationId: string;
  phone: string;
  provider: string;
  providerMessageId: string;
  occurredAt: unknown;
}) {
  const admin = createAdminClient();
  const organization = await resolveActiveRealEstateOrganization(admin, input.organizationId);
  if (!organization) return false;
  const phone = normalizedPhone(input.phone);
  const provider = String(input.provider || "").trim().slice(0, 64);
  const providerMessageId = String(input.providerMessageId || "").trim().slice(0, 200);
  if (!phone || provider !== "meta_whatsapp" || !providerMessageId) return false;
  const { error } = await admin.rpc("record_real_estate_customer_service_window", {
    p_organization_id: organization.id,
    p_phone_normalized: phone,
    p_provider: provider,
    p_provider_message_id: providerMessageId,
    p_last_inbound_at: parseInboundTimestamp(input.occurredAt),
  });
  if (error) throw error;
  return true;
}

export async function getRealEstateDirectWindowLastInboundAt(organizationId: string, phoneValue: string, now = Date.now()) {
  const phone = normalizedPhone(phoneValue);
  if (!phone) return null;
  const admin = createAdminClient();
  const organization = await resolveActiveRealEstateOrganization(admin, organizationId);
  if (!organization) return null;
  const { data, error } = await admin.from("real_estate_customer_service_windows")
    .select("phone_normalized,last_inbound_at")
    .eq("organization_id", organization.id)
    .eq("provider", "meta_whatsapp")
    .eq("phone_normalized", phone)
    .order("last_inbound_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const lastInboundAt = String(data?.last_inbound_at || "");
  return isWithinCustomerServiceWindow(lastInboundAt, now) ? lastInboundAt : null;
}

export async function getRealEstateDirectWindowPhones(organizationId: string, phones: string[], now = Date.now()) {
  const unique = [...new Set(phones.map(normalizedPhone).filter(Boolean))];
  if (!unique.length) return new Set<string>();
  const admin = createAdminClient();
  const organization = await resolveActiveRealEstateOrganization(admin, organizationId);
  if (!organization) return new Set<string>();
  const eligible = new Set<string>();
  const chunkSize = 100;
  for (let batchStart = 0; batchStart < unique.length; batchStart += chunkSize * 5) {
    const batches = Array.from({ length: Math.min(5, Math.ceil((unique.length - batchStart) / chunkSize)) }, (_, index) => unique.slice(batchStart + index * chunkSize, batchStart + (index + 1) * chunkSize));
    const results = await Promise.all(batches.map((batch) => admin.from("real_estate_customer_service_windows")
      .select("phone_normalized,last_inbound_at")
      .eq("organization_id", organization.id)
      .eq("provider", "meta_whatsapp")
      .in("phone_normalized", batch)));
    for (const { data, error } of results) {
      if (error) throw error;
      for (const row of data || []) {
        if (isWithinCustomerServiceWindow(row.last_inbound_at, now)) eligible.add(String(row.phone_normalized));
      }
    }
  }
  return eligible;
}
