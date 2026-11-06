"use client";

import { useState } from "react";
import { deletePropertyAction } from "@/app/dashboard/actions";

export default function DeletePropertyButton({ propertyId, propertyTitle }: { propertyId: string; propertyTitle: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <form action={async (formData) => {
      setPending(true);
      setError("");
      try {
        const result = await deletePropertyAction(formData);
        setError(result.error);
      } catch {
        setError("Unable to delete this property. Please try again.");
      } finally {
        setPending(false);
      }
    }}>
    <input type="hidden" name="property_id" value={propertyId} />
    <button
      type="submit"
      className="danger-button"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(`Delete ${propertyTitle}? This will permanently remove the property record.`)) {
          event.preventDefault();
          return;
        }
      }}
    >
      {pending ? "Deleting…" : "Delete property"}
    </button>
    {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
