import { createAdminClient } from "@/lib/supabase/admin";

export type InstallmentReminderCounts = {
  activePlans: number;
  pending: number;
  accepted: number;
  failed: number;
  unknown: number;
};

/** Read-only counters, independent of the paginated payment/attempt lists. */
export async function getInstallmentReminderCounts(organizationId: string): Promise<InstallmentReminderCounts> {
  if (!organizationId || organizationId.startsWith("unavailable:")) throw new Error("Active organization context is required.");
  const admin = createAdminClient();
  const attemptCount = (status: string) => admin.from("reminder_attempts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("status", status);
  const results = await Promise.all([
    admin.from("payment_plans").select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId).eq("payment_type", "installment")
      .eq("status", "active").eq("reminders_enabled", true).gt("outstanding_balance", 0),
    attemptCount("pending"), attemptCount("sent"), attemptCount("failed"), attemptCount("unknown"),
  ]);
  if (results.some(result => result.error || result.count === null || !Number.isSafeInteger(result.count) || Number(result.count) < 0)) {
    throw new Error("Installment reminder counts are temporarily unavailable.");
  }
  const [activePlans, pending, accepted, failed, unknown] = results.map(result => result.count as number);
  return { activePlans, pending, accepted, failed, unknown };
}
