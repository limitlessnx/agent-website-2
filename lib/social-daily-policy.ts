import { getSocialReviewReadiness } from "@/lib/social-review-readiness";
import type { SocialPostFormat } from "@/lib/social";

export const DAILY_SOURCE = "fluxknight-daily-instagram-v1";
export const DAILY_ORGANIZATION = "15046426-e520-438b-8694-7662a6986efb";
export const DAILY_BRAND = "a330b65a-d5b2-45f3-b211-451616f2fa8d";
export type DailyPolicy = { enabled: true; timezone: "Africa/Lagos"; local_time: "18:00"; enabled_at: string; minimum_week_start: string };
export type DailyPost = { id: string; organization_id: string; brand_id: string; status: string; approved_at: string | null; published_at: string | null; format: SocialPostFormat; platforms: string[]; content: Record<string, unknown>; metadata: Record<string, unknown>; created_at: string };
export type DailySchedule = { id: string; post_id: string; scheduled_for: string; status: string; claimed_at: string | null; metadata: Record<string, unknown> };

export function dailyPolicy(metadata: Record<string, unknown>): DailyPolicy | null {
  const value = metadata.daily_publishing as Partial<DailyPolicy> | undefined;
  if (value?.enabled !== true) return null;
  if (value.timezone !== "Africa/Lagos" || value.local_time !== "18:00" || !value.enabled_at || !Number.isFinite(Date.parse(value.enabled_at)) || !/^\d{4}-\d{2}-\d{2}$/.test(value.minimum_week_start || "")) {
    throw new Error("Invalid approved daily publishing configuration.");
  }
  return value as DailyPolicy;
}

export function lagosDay(date: Date) { return new Date(date.getTime() + 3_600_000).toISOString().slice(0, 10); }
export function slotForDay(day: string) { return `${day}T17:00:00.000Z`; }
export function nextDay(day: string) { return new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10); }
export function dayBounds(now: Date) {
  const day = lagosDay(now);
  return { day, start: new Date(Date.parse(`${day}T00:00:00Z`) - 3_600_000).toISOString(), end: new Date(Date.parse(`${nextDay(day)}T00:00:00Z`) - 3_600_000).toISOString() };
}
export function sameApproval(post: Pick<DailyPost, "approved_at">, schedule: Pick<DailySchedule, "metadata">) {
  return Boolean(post.approved_at && typeof schedule.metadata.approval_snapshot === "string" && Date.parse(post.approved_at) === Date.parse(schedule.metadata.approval_snapshot));
}
export function eligibleDailyPost(post: DailyPost, policy: DailyPolicy) {
  return post.organization_id === DAILY_ORGANIZATION && post.brand_id === DAILY_BRAND &&
    ["approved", "scheduled"].includes(post.status) && Boolean(post.approved_at) && !post.published_at &&
    post.platforms.includes("instagram") && ["image", "carousel", "reel", "video"].includes(post.format) &&
    (String(post.content.week_start || "") >= policy.minimum_week_start || Date.parse(post.approved_at!) >= Date.parse(policy.enabled_at)) &&
    getSocialReviewReadiness(post).ready;
}

// Future slots only. Missed days move to the queue's next free day, never to a
// burst of catch-up publications. Historical/manual schedules are not adopted.
export function planDailySlots(posts: DailyPost[], schedules: DailySchedule[], policy: DailyPolicy, now: Date, publishedDays: string[] = []) {
  const today = lagosDay(now);
  const occupied = new Set(publishedDays);
  for (const schedule of schedules) {
    if (["pending", "claimed", "completed"].includes(schedule.status)) occupied.add(lagosDay(new Date(schedule.scheduled_for)));
  }
  let day = Date.parse(slotForDay(today)) > now.getTime() ? today : nextDay(today);
  const byPost = new Map(schedules.map((schedule) => [schedule.post_id, schedule]));
  const assignments: Array<{ post: DailyPost; scheduledFor: string; existing?: DailySchedule }> = [];
  const ordered = [...posts].sort((a, b) => String(a.content.week_start || a.approved_at).localeCompare(String(b.content.week_start || b.approved_at)) || Number(a.content.planned_index || 999) - Number(b.content.planned_index || 999) || a.created_at.localeCompare(b.created_at));
  for (const post of ordered) {
    if (!eligibleDailyPost(post, policy)) continue;
    const existing = byPost.get(post.id);
    if (existing) {
      if (existing.metadata.source !== DAILY_SOURCE || existing.status === "completed" || existing.status === "claimed") continue;
      if (existing.status === "pending" && sameApproval(post, existing) && lagosDay(new Date(existing.scheduled_for)) >= today) {
        if (post.status === "approved") assignments.push({ post, scheduledFor: existing.scheduled_for, existing });
        continue;
      }
      if (["cancelled", "failed"].includes(existing.status) && sameApproval(post, existing)) continue;
    } else if (post.status !== "approved") continue;
    while (occupied.has(day)) day = nextDay(day);
    assignments.push({ post, scheduledFor: slotForDay(day), ...(existing ? { existing } : {}) });
    occupied.add(day);
    day = nextDay(day);
  }
  return assignments;
}
