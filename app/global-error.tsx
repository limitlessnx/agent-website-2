"use client";

import { useEffect } from "react";
import { toUserSafeMessage } from "@/lib/user-safe-errors";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Fluxknight global error", { digest: error?.digest });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flux-safe-error" role="alert">
          <section className="flux-safe-error-card">
            <span className="flux-safe-error-eyebrow">Fluxknight</span>
            <h1>We couldn't complete that</h1>
            <p>{toUserSafeMessage(error)}</p>
            <button type="button" onClick={() => reset()}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
