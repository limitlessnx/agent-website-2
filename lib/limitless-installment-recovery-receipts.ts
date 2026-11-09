import { createAdminClient } from "@/lib/supabase/admin";

const ORGANIZATION_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";
const FAILED_OCCURRENCES = new Set([
  "baa11de9-9326-41d6-8693-4dd1c5646532",
  "bd6f3b34-4158-40d1-a8f6-31f599ca640a",
  "22ceecc5-5ad3-4b7a-b8e6-773c68bd1f5b",
  "7cf10382-9efd-4884-bc12-d4a351467ae6",
]);
const rank: Record<string, number> = { unknown: 0, accepted: 0, sent: 1, failed: 2, delivered: 3, read: 4 };

/** Only called after Meta signature verification and phone-to-tenant resolution. */
export async function syncLimitlessInstallmentRecoveryReceipt(input: {
  organizationId: string;
  callbackData: unknown;
  providerMessageId: string;
  patch: Record<string, unknown>;
}) {
  if (input.organizationId !== ORGANIZATION_ID || typeof input.callbackData !== "string") return false;
  const prefix = "limitless-installment-recovery:";
  if (!input.callbackData.startsWith(prefix) || !FAILED_OCCURRENCES.has(input.callbackData.slice(prefix.length))) return false;
  if (!input.providerMessageId || !Object.hasOwn(rank, String(input.patch.status))) throw new Error("Invalid installment recovery receipt.");
  const admin = createAdminClient();
  const { data: row, error } = await admin.from("whatsapp_delivery_attempts")
    .select("id,status,provider_message_id").eq("organization_id", ORGANIZATION_ID)
    .eq("template_name", "installment_reminder").contains("request_payload", { installment_recovery_key: input.callbackData }).maybeSingle();
  if (error || !row) throw new Error("Installment recovery receipt has no unique preclaimed delivery record.");
  if (row.provider_message_id && row.provider_message_id !== input.providerMessageId) throw new Error("Installment recovery message ID conflict.");
  if (rank[String(row.status)] >= rank[String(input.patch.status)]) return true;
  let update = admin.from("whatsapp_delivery_attempts").update({ ...input.patch, provider_message_id: input.providerMessageId })
    .eq("id", row.id).eq("organization_id", ORGANIZATION_ID).eq("status", row.status);
  update = row.provider_message_id ? update.eq("provider_message_id", row.provider_message_id) : update.is("provider_message_id", null);
  const result = await update.select("id").maybeSingle();
  if (result.error || !result.data?.id) throw new Error("Installment recovery receipt raced; redelivery is required.");
  return true;
}
