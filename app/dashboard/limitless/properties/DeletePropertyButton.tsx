"use client";

import { useState } from "react";

export default function DeletePropertyButton({ propertyId, propertyTitle }: { propertyId: string; propertyTitle: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="submit"
      className="danger-button"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(`Delete ${propertyTitle}? This will permanently remove the property record.`)) {
          event.preventDefault();
          return;
        }
        setPending(true);
      }}
    >
      {pending ? "Deleting…" : "Delete property"}
    </button>
  );
}
