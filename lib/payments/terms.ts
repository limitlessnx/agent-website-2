export type PrepaidTerm = "3m" | "6m" | "12m";

export const PREPAID_TERMS: Record<PrepaidTerm, { months: number; discountPercent: number; label: string }> = {
  "3m": { months: 3, discountPercent: 10, label: "3 months" },
  "6m": { months: 6, discountPercent: 15, label: "6 months" },
  "12m": { months: 12, discountPercent: 20, label: "1 year" },
};

export function isPrepaidTerm(value: unknown): value is PrepaidTerm {
  return typeof value === "string" && value in PREPAID_TERMS;
}

export function calculatePrepaidPrice(installationFee: number, recurringFee: number, term: PrepaidTerm) {
  const config = PREPAID_TERMS[term];
  const subtotal = installationFee + recurringFee * config.months;
  const discount = subtotal * (config.discountPercent / 100);
  const total = Math.round((subtotal - discount) * 100) / 100;

  return {
    term,
    months: config.months,
    label: config.label,
    discountPercent: config.discountPercent,
    subtotal,
    discount,
    total,
  };
}
