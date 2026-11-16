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
