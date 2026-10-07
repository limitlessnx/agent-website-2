const FRIENDLY_MESSAGES: Array<[RegExp, string]> = [
  [/handover agent name and whatsapp number are required/i, "Please enter the handover agent's name and WhatsApp number before creating the installment plan."],
  [/client, phone, and property\/service context are required/i, "Please complete the client's name, phone number, and property details before continuing."],
  [/client, phone, and property are required/i, "Please complete the client's name, phone number, and property details before continuing."],
  [/agreed amount must be greater than zero/i, "Please enter an agreed amount greater than zero."],
  [/amount paid must be between zero and the agreed amount/i, "The amount paid cannot be greater than the agreed amount."],
  [/installment end date cannot be before the start date/i, "The installment end date cannot be before the start date."],
  [/valid installment start date/i, "Please enter a valid installment start date."],
  [/valid installment end date/i, "Please enter a valid installment end date."],
  [/invalid installment reminder cadence/i, "Please choose Weekly, Bi-weekly, or Monthly for the reminder cadence."],
  [/selected contact is not available/i, "That contact is no longer available in this workspace. Please select the contact again."],
  [/active organization context is required/i, "We couldn't confirm the active workspace. Please refresh and try again."],
  [/payment tables are not ready/i, "The payment workspace is still being prepared. Please try again shortly."],
  [/payment cannot exceed the remaining outstanding balance/i, "This payment is greater than the remaining balance. Please enter a smaller amount."],
  [/select a payment plan and enter a valid payment amount/i, "Please select an installment plan and enter a valid payment amount."],
];

export function toUserSafeMessage(error: unknown, fallback = "We couldn't complete that request right now. Your existing data has not been changed. Please try again.") {
  const raw = error instanceof Error ? error.message : String(error || "");
  const match = FRIENDLY_MESSAGES.find(([pattern]) => pattern.test(raw));
  return match?.[1] || fallback;
}

export function isNextRedirectError(error: unknown) {
  const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest || "") : "";
  return digest.startsWith("NEXT_REDIRECT");
}
