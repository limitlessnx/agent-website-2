"use client";

import { useState, type ReactNode } from "react";

/** Keep a failed media action in its form instead of replacing the whole Review page. */
export function MediaActionForm({ action, children }: { action: (data: FormData) => Promise<void>; children: ReactNode }) {
  const [error, setError] = useState("");
  return <form action={async (data) => {
    setError("");
    try { await action(data); }
    catch { setError("Media generation could not be completed. Please try again. For an older Reel, regenerate its storyboard before rendering."); }
  }}>
    {children}
    {error ? <p role="alert" style={{ marginTop: 10, color: "#fca5a5", maxWidth: 460 }}>{error}</p> : null}
  </form>;
}
