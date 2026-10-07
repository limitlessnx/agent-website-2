"use client";

import { useEffect } from "react";
import { toUserSafeMessage } from "@/lib/user-safe-errors";

export default function LimitlessError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Fluxknight workspace error", { digest: error?.digest });
  }, [error]);

  return (
    <main className="flux-safe-error" role="alert">
      <section className="flux-safe-error-card">
        <span className="flux-safe-error-eyebrow">Workspace action</span>
        <h1>We couldn't complete that</h1>
        <p>{toUserSafeMessage(error)}</p>
        <button type="button" onClick={() => reset()}>Return and try again</button>
      </section>
    </main>
  );
}
