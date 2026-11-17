import type { SupabaseClient } from "@supabase/supabase-js";
import { DAILY_BRAND, DAILY_ORGANIZATION, DAILY_SOURCE, dailyPolicy, dayBounds, eligibleDailyPost, lagosDay, planDailySlots, sameApproval, type DailyPost, type DailySchedule } from "@/lib/social-daily-policy";

export async function runDailyPublishing(db: SupabaseClient, now: Date, scheduleOnly: boolean, dispatch: (scheduleId: string) => Promise<unknown>) {
  const { data: brand, error: brandError } = await db.from("social_brands").select("metadata")
    .eq("organization_id", DAILY_ORGANIZATION).eq("id", DAILY_BRAND).single();
  if (brandError) throw brandError;
  const policy = dailyPolicy(brand.metadata || {});
  if (!policy) return { skipped: true, reason: "daily_publishing_disabled" };
  const { data: organization, error: organizationError } = await db.from("organizations").select("status").eq("id", DAILY_ORGANIZATION).single();
  if (organizationError) throw organizationError;
  if (organization.status !== "active") return { skipped: true, reason: "organization_inactive" };
  const bounds = dayBounds(now);
  const [postResult, scheduleResult, publishedResult] = await Promise.all([
    db.from("social_posts").select("id,organization_id,brand_id,status,approved_at,published_at,format,platforms,content,metadata,created_at")
      .eq("organization_id", DAILY_ORGANIZATION).eq("brand_id", DAILY_BRAND).in("status", ["approved", "scheduled"]).limit(2000),
    db.from("social_schedules").select("id,post_id,scheduled_for,status,claimed_at,metadata").eq("organization_id", DAILY_ORGANIZATION)
      .in("status", ["pending", "claimed", "completed", "cancelled", "failed"]).order("scheduled_for").limit(2000),
    db.from("social_posts").select("id,published_at").eq("organization_id", DAILY_ORGANIZATION).eq("brand_id", DAILY_BRAND)
      .gte("published_at", bounds.start).lt("published_at", bounds.end).limit(10),
  ]);
  for (const result of [postResult, scheduleResult, publishedResult]) if (result.error) throw result.error;
  // Never silently truncate a growing queue.
  if (postResult.data?.length === 2000 || scheduleResult.data?.length === 2000) throw new Error("Daily publishing queue exceeded the supported batch size.");
  const posts = (postResult.data || []) as DailyPost[];
  let schedules = (scheduleResult.data || []) as DailySchedule[];
  const refs = posts.length ? await db.from("social_post_platform_refs").select("post_id").eq("organization_id", DAILY_ORGANIZATION)
    .eq("brand_id", DAILY_BRAND).eq("platform", "instagram").in("post_id", posts.map((post) => post.id)) : { data: [], error: null };
  if (refs.error) throw refs.error;
  const publishedIds = new Set((refs.data || []).map((row) => row.post_id));
  const eligible = posts.filter((post) => !publishedIds.has(post.id));
  const byId = new Map(eligible.map((post) => [post.id, post]));
  for (const schedule of schedules) {
    if (schedule.metadata.source !== DAILY_SOURCE || !["pending", "claimed"].includes(schedule.status)) continue;
    const post = byId.get(schedule.post_id);
    const expired = schedule.status === "claimed" && schedule.claimed_at && now.getTime() - Date.parse(schedule.claimed_at) > 20 * 60_000;
    const invalid = !post || !eligibleDailyPost(post, policy) || !sameApproval(post, schedule);
    if (!invalid && !expired) continue;
    const nextStatus = expired ? "failed" : "cancelled";
    const { error } = await db.from("social_schedules").update({ status: nextStatus, last_error: expired
      ? "Publishing worker did not finish. Check Instagram before retrying." : "Approval changed or post is no longer eligible for automatic publishing." })
      .eq("organization_id", DAILY_ORGANIZATION).eq("id", schedule.id).eq("status", schedule.status);
    if (error) throw error;
    schedule.status = nextStatus;
  }
  const assignments = planDailySlots(eligible, schedules, policy, now, (publishedResult.data || []).map((post) => lagosDay(new Date(post.published_at))));
  const booked: Array<{ postId: string; scheduledFor: string }> = [];
  for (const assignment of assignments) {
    const { post, scheduledFor, existing } = assignment;
    const metadata = { source: DAILY_SOURCE, publish_platforms: ["instagram"], approval_snapshot: post.approved_at,
      authorization: "user-approved-daily-18:00-WAT-current-and-future" };
    if (!existing || existing.scheduled_for !== scheduledFor || !sameApproval(post, existing)) {
      const change = { scheduled_for: scheduledFor, timezone: policy.timezone, status: "pending", claimed_at: null, completed_at: null, last_error: null, metadata };
      const result = existing
        ? await db.from("social_schedules").update(change).eq("organization_id", DAILY_ORGANIZATION).eq("id", existing.id).eq("status", existing.status)
        : await db.from("social_schedules").insert({ ...change, organization_id: DAILY_ORGANIZATION, post_id: post.id });
      if (result.error) throw result.error;
    }
    const { data: updated, error } = await db.from("social_posts").update({ status: "scheduled" }).eq("organization_id", DAILY_ORGANIZATION)
      .eq("brand_id", DAILY_BRAND).eq("id", post.id).eq("status", post.status).eq("approved_at", post.approved_at).select("id").maybeSingle();
    if (error) throw error;
    if (updated) booked.push({ postId: post.id, scheduledFor });
  }
  if (scheduleOnly) return { booked, scheduleOnly: true, dispatched: false };
  // Refresh schedules and approval immediately before claiming a due item.
  const { data: fresh, error: freshError } = await db.from("social_schedules").select("id,post_id,scheduled_for,status,claimed_at,metadata")
    .eq("organization_id", DAILY_ORGANIZATION).eq("metadata->>source", DAILY_SOURCE).in("status", ["pending", "claimed", "completed"])
    .gte("scheduled_for", bounds.start).lt("scheduled_for", bounds.end).order("scheduled_for");
  if (freshError) throw freshError;
  schedules = (fresh || []) as DailySchedule[];
  if (publishedResult.data?.length || schedules.some((schedule) => ["claimed", "completed"].includes(schedule.status))) return { booked, dispatched: false, reason: "daily_slot_used_or_running" };
  const due = schedules.find((schedule) => schedule.status === "pending" && Date.parse(schedule.scheduled_for) <= now.getTime());
  if (!due) return { booked, dispatched: false, reason: "no_due_post" };
  const { data: current, error: currentError } = await db.from("social_posts").select("*").eq("organization_id", DAILY_ORGANIZATION).eq("brand_id", DAILY_BRAND).eq("id", due.post_id).single();
  if (currentError) throw currentError;
  if (!eligibleDailyPost(current as DailyPost, policy) || current.status !== "scheduled" || !sameApproval(current as DailyPost, due)) return { booked, dispatched: false, reason: "approval_changed" };
  const { data: claimed, error: claimError } = await db.from("social_schedules").update({ status: "claimed", claimed_at: now.toISOString(), last_error: null })
    .eq("organization_id", DAILY_ORGANIZATION).eq("id", due.id).eq("status", "pending").eq("scheduled_for", due.scheduled_for).select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { booked, dispatched: false, reason: "already_claimed" };
  try { await dispatch(due.id); }
  catch (error) {
    await db.from("social_schedules").update({ status: "pending", claimed_at: null, last_error: "Publisher could not be queued; the next cycle will retry." })
      .eq("organization_id", DAILY_ORGANIZATION).eq("id", due.id).eq("status", "claimed");
    throw error;
  }
  return { booked, dispatched: true, scheduleId: due.id };
}
