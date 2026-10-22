export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "custom";

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function addCalendarMonths(anchor: Date, months: number): Date {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const day = anchor.getUTCDate();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds()));
}
export function getLatestRecurrence(anchor: Date, now: Date, frequency: RecurrenceFrequency, customInterval = 1): Date | null {
  if (anchor.getTime() > now.getTime()) return null;
  if (frequency === "daily" || frequency === "weekly" || frequency === "biweekly" || frequency === "custom") {
    const days = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : Math.max(1, Math.min(365, Math.floor(Number(customInterval) || 1)));
    const interval = days * 86_400_000;
    return new Date(anchor.getTime() + Math.floor((now.getTime() - anchor.getTime()) / interval) * interval);
  }
  const months = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : frequency === "yearly" ? 12 : 0;
  if (!months) return null;
  let count = Math.max(0, (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + now.getUTCMonth() - anchor.getUTCMonth());
  let occurrence = addCalendarMonths(anchor, count);
  while (occurrence > now && count > 0) occurrence = addCalendarMonths(anchor, --count);
  while (addCalendarMonths(anchor, count + 1) <= now) occurrence = addCalendarMonths(anchor, ++count);
  // Calculate from the original anchor so Jan 31 -> Feb 28 -> Mar 31, not Mar 28.
  const cadenceCount = Math.floor(count / months) * months;
  occurrence = addCalendarMonths(anchor, cadenceCount);
  while (occurrence > now && cadenceCount > 0) occurrence = addCalendarMonths(anchor, Math.max(0, cadenceCount - months));
  return occurrence;
}
export function resolveFixedDate(configDate: unknown, now: Date): Date | null {
  const date = validDate(configDate);
  if (!date) return null;
  const due = new Date(date);
  due.setUTCHours(9, 0, 0, 0);
  if (due > now || now.getTime() - due.getTime() >= 86_400_000) return null;
  return due;
}
