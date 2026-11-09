import { createAdminClient } from "@/lib/supabase/admin";
import type { HotelTrends } from "@/lib/hotel-trends-contract";

export async function loadHotelTrends(org: string, day: string, timeZone: string, canViewPayments: boolean): Promise<HotelTrends> {
  const { data, error } = await createAdminClient().rpc("hotel_dashboard_trends", {
    p_organization_id: org, p_day: day, p_timezone: timeZone, p_include_payments: canViewPayments,
  });
  if (error || !data) throw new Error("Hotel trend data is unavailable.");
  // Defense in depth: never serialize financial values for an operator without finance access.
  return { daily: data.daily, revenue: canViewPayments ? data.revenue : null };
}
