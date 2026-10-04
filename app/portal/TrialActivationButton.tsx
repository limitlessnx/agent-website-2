"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "@/components/admin/ServerIcons";

export default function TrialActivationButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startTrial() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/client-auth/start-trial", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to start the Basic free trial.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start the Basic free trial.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className="portal-button" onClick={startTrial} disabled={loading}>
        {loading ? <Loader2 className="spin" size={15} /> : null}
        {loading ? "Starting trial..." : "Start 14-day free trial"} <ArrowRight size={15} />
      </button>
      {error ? <small style={{ display: "block", marginTop: 8, color: "#fca5a5" }}>{error}</small> : null}
    </div>
  );
}
