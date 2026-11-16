export function socialWeekStart(input = new Date()) {
  const day = input.getUTCDay();
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate() + (day === 0 ? -6 : 1 - day))).toISOString().slice(0, 10);
}

export function validSocialWeek(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

export function socialWeeklyPostCount(metadata: Record<string, unknown> | undefined): 5 | 7 {
  return metadata?.weekly_post_count === 7 ? 7 : 5;
}

export function socialWeeklyFormatMix(metadata: Record<string, unknown>, weekStart: string) {
  const configured = metadata.weekly_format_mix;
  if (!configured) return null;
  if (typeof configured !== "object" || Array.isArray(configured)) throw new Error("Invalid weekly format mix.");
  const mix = configured as Record<string, unknown>;
  if (!validSocialWeek(mix.effective_week_start) || mix.carousel !== 4 || mix.reel !== 3) {
    throw new Error("Weekly format mix requires four carousels, three Reels and a valid starting Monday.");
  }
  return weekStart >= mix.effective_week_start ? { carousel: 4, reel: 3 } : null;
}
