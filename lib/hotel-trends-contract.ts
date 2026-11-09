export type HotelTrends = {
  daily: Array<{ day: string; bookings: number; checkins: number }>;
  revenue: Array<{ currency: string; points: Array<{ day: string; amount_minor: string }> }> | null;
};

/** Avoid converting aggregate receipts to Number, which loses cents above 2^53. */
export function hotelTrendMoney(minor: string, currency: string) {
  const formatter = new Intl.NumberFormat("en", { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = BigInt(10) ** BigInt(digits), amount = BigInt(minor);
  return formatter.formatToParts(amount / scale).map(part => part.type === "fraction" ? (amount % scale).toString().padStart(digits, "0") : part.value).join("");
}

/** Exact integer comparison; zero baselines never produce an invented percentage. */
export function hotelTrendLabel(current: string | number, previous: string | number) {
  const a = BigInt(current), b = BigInt(previous);
  if (b === BigInt(0)) return a === BigInt(0) ? "No change" : "New · no prior baseline";
  const delta = ((a - b) * BigInt(1000)) / b;
  if (delta === BigInt(0)) return "No change";
  const magnitude = delta < BigInt(0) ? -delta : delta;
  return `${delta > BigInt(0) ? "+" : "−"}${magnitude / BigInt(10)}${magnitude % BigInt(10) ? "." + magnitude % BigInt(10) : ""}%`;
}

export function hotelSparkline(values: string[]) {
  const amounts = values.map(value => BigInt(value));
  const max = amounts.reduce((a, b) => a > b ? a : b, BigInt(0));
  return amounts.map((value, index) => `${amounts.length <= 1 ? 0 : index * 100 / (amounts.length - 1)},${max ? 30 - Number(value * BigInt(2600) / max) / 100 : 30}`).join(" ");
}
