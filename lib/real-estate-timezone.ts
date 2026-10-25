export function validateTimeZone(timeZone: string) {
  try { new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()); }
  catch { throw new Error("A valid IANA timezone is required."); }
  return timeZone;
}

/** Convert wall-clock input in its selected zone, never the server's local zone. */
export function realEstateDateTimeToIso(input: string, timeZone: string) {
  validateTimeZone(timeZone);
  const value = input.trim();
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error("A valid date/time is required.");
    return date.toISOString();
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error("Use a local ISO date/time or an ISO date/time with an explicit UTC offset.");
  const [year,month,day,hour,minute,second] = match.slice(1).map(Number);
  const target = Date.UTC(year,month-1,day,hour,minute,second||0);
  const check = new Date(target);
  if (check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day||hour>23||minute>59||(second||0)>59) throw new Error("A valid calendar date/time is required.");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23" });
  const wallTime = (timestamp:number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part=>[part.type,part.value]));
    return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
  };
  const offsets = new Set([-86400000,0,86400000].map(delta=>wallTime(target+delta)-(target+delta)));
  const candidates = [...offsets].map(offset=>target-offset).filter(timestamp=>wallTime(timestamp)===target);
  if (!candidates.length) throw new Error("This local time does not exist in the selected timezone. Choose another time.");
  if (candidates.length!==1) throw new Error("This local time is ambiguous in the selected timezone. Supply an explicit UTC offset.");
  return new Date(candidates[0]).toISOString();
}
