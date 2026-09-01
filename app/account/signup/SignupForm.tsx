"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import FluxknightLogo from "@/components/admin/FluxknightLogo";

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = new FormData(event.currentTarget);
      const email = String(data.get("email") || "").trim().toLowerCase();
      const response = await fetch("/api/client-auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: data.get("full_name"),
          company_name: data.get("company_name"),
          email,
          password: data.get("password"),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || "Unable to create account.");
        return;
      }

      if (result.requires_email_confirmation) {
        router.push(`/account/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      router.push("/portal");
      router.refresh();
    } catch {
      setError("We could not connect to the account service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="admin-login-card">
      <div className="admin-login-icon"><FluxknightLogo compact priority /></div>
      <div>
        <p className="admin-kicker">Fluxknight Client Portal</p>
        <h1>Create your workspace</h1>
        <p className="admin-muted">Create your company account and owner access.</p>
      </div>
      <label>Full name<input name="full_name" required minLength={2} autoComplete="name" /></label>
      <label>Company name<input name="company_name" required minLength={2} autoComplete="organization" /></label>
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
      <p className="admin-muted">Already registered? <Link href="/account/login">Sign in</Link></p>
    </form>
  );
}
