"use client";

import { useFormStatus } from "react-dom";

export default function PaymentSubmitButton({ children, className = "admin-button" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? <span className="payment-button-spinner" aria-hidden="true" /> : null}
      {pending ? "Processing…" : children}
    </button>
  );
}
