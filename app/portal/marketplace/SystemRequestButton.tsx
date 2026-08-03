"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SystemRequestButton({ slug, disabled = false }: { slug: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function requestSystem() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal/systems/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to add this system.");
      setMessage("Added to My Systems.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add this system.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-system-action">
      <button className="portal-button" type="button" disabled={disabled || busy} onClick={requestSystem}>
        {disabled ? "Coming soon" : busy ? "Adding..." : "Add to organization"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
