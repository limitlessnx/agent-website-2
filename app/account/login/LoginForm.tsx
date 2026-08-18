"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "@/components/admin/ServerIcons";

export default function ClientLoginForm({ txRef = "", nextPath = "/portal" }: { txRef?: string; nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const safeNext = nextPath.startsWith("/") ? nextPath : "/portal";
  const signupHref = txRef
    ? `/account/signup?tx_ref=${encodeURIComponent(txRef)}&next=${encodeURIComponent(safeNext)}`
    : "/account/signup";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/client-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || "Unable to sign in.");
        return;
      }

      if (result.requires_workspace_setup) {
        router.push("/account/setup");
        return;
      }

      const destination = new URL(safeNext, window.location.origin);
      if (txRef && safeNext === "/onboarding") destination.searchParams.set("tx_ref", txRef);
      router.push(`${destination.pathname}${destination.search}`);
      router.refresh();
    } catch {
      setError("We could not connect to the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="admin-login-card">
      <div className="admin-login-icon"><LogIn size={22} /></div>
      <div>
        <p className="admin-kicker">Fluxknight Client Portal</p>
        <h1>Client sign in</h1>
        <p className="admin-muted">Access your organization workspace.</p>
      </div>
      {txRef ? <p className="admin-form-message">Your payment is verified. Sign in to continue to onboarding.</p> : null}
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      <p className="admin-muted">Need an account? <Link href={signupHref}>Create workspace</Link></p>
    </form>
  );
}
