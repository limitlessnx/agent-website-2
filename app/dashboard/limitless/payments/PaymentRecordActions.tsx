"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { PaymentRecord } from "@/lib/limitless-payments";
import { formatNaira } from "@/lib/limitless-payments";
import { deletePaymentRecordAction, updatePaymentRecordAction } from "./actions";

function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? <span className="payment-button-spinner" aria-hidden="true" /> : null}
      {pending ? "Processing…" : children}
    </button>
  );
}

export default function PaymentRecordActions({ record }: { record: PaymentRecord }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="payment-record-actions">
      <div className="payment-record-main">
        <div>
          <strong>{formatNaira(record.amount)}</strong>
          <span>{record.payment_date} · {record.payment_method || "Method not set"} · {record.payment_reference || "No reference"}</span>
          {record.notes ? <small>{record.notes}</small> : null}
        </div>
        <div className="payment-record-buttons">
          <button type="button" className="payment-action-button" onClick={() => setEditing((value) => !value)}>
            {editing ? "Cancel" : "Edit"}
          </button>
          <form
            action={deletePaymentRecordAction}
            onSubmit={(event) => {
              if (!window.confirm("Delete this payment record? The client's recorded total will be recalculated.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="payment_record_id" value={record.id} />
            <SubmitButton className="payment-action-button danger">Delete</SubmitButton>
          </form>
        </div>
      </div>

      {editing ? (
        <form action={updatePaymentRecordAction} className="payment-record-edit-form">
          <input type="hidden" name="payment_record_id" value={record.id} />
          <input name="amount" type="number" min="1" defaultValue={record.amount} required aria-label="Payment amount" />
          <input name="payment_date" type="date" defaultValue={record.payment_date} required aria-label="Payment date" />
          <select name="payment_method" defaultValue={record.payment_method || "bank_transfer"} aria-label="Payment method">
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
          <input name="payment_reference" defaultValue={record.payment_reference || ""} placeholder="Payment reference" aria-label="Payment reference" />
          <input name="notes" defaultValue={record.notes || ""} placeholder="Notes" aria-label="Payment notes" />
          <SubmitButton className="admin-button">Save changes</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
