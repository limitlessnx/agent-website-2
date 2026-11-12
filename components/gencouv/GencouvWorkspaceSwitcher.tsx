"use client";

import { useState } from "react";

export default function GencouvWorkspaceSwitcher() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function switchWorkspace() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/organization-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "system", id: "gencouv" }),
      });
      if (!response.ok) throw new Error("Unable to switch workspace.");
      window.location.assign("/dashboard/gencouv");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to switch workspace.");
      setBusy(false);
    }
  }
  return <aside role="status" style={{padding:14,marginBottom:16,border:"1px solid var(--fk-border)",borderRadius:12,background:"var(--fk-surface)"}}>
    <p style={{margin:"0 0 10px",lineHeight:1.5}}>Gencouv is open, but another organization is selected. Switch workspaces to manage Gencouv contacts and categories safely.</p>
    <button type="button" onClick={switchWorkspace} disabled={busy} style={{padding:"10px 14px",borderRadius:10,border:"1px solid var(--fk-border)",background:"var(--fk-brand-strong)",color:"#fff",cursor:"pointer"}}>
      {busy ? "Switching…" : "Switch to Gencouv"}
    </button>
    {error && <p role="alert">{error}</p>}
  </aside>;
}
