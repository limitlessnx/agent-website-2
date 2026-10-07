"use client";

import { useEffect } from "react";
import { toUserSafeMessage } from "@/lib/user-safe-errors";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Fluxknight route error", { digest: error?.digest });
  }, [error]);

  return (
    <main className="flux-safe-error" role="alert">
      <section className="flux-safe-error-card">
        <span className="flux-safe-error-eyebrow">We couldn't complete that</span>
        <h1>Something needs your attention</h1>
        <p>{toUserSafeMessage(error)}</p>
        <button type="button" onClick={() => reset()}>Try again</button>
      </section>
    </main>
  );
}
