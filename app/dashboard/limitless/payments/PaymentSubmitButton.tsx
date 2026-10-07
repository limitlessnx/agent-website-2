"use client";

import { useFormStatus } from "react-dom";

function pendingLabel(children: React.ReactNode) {
  if (typeof children !== "string") return "Processing…";
  if (/create installment plan/i.test(children)) return "Creating…";
  if (/save payment/i.test(children)) return "Saving…";
  if (/set cadence/i.test(children)) return "Saving…";
  if (/update/i.test(children)) return "Updating…";
  return "Processing…";
}

export default function PaymentSubmitButton({ children, className = "admin-button" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  const label = pendingLabel(children);

  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? <span className="payment-button-spinner" aria-hidden="true" /> : null}
      {pending ? label : children}
    </button>
  );
}
