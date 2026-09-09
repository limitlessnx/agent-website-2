"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "@/components/admin/ServerIcons";

type SignupFormProps = {
  txRef?: string;
  nextPath?: string;
  trialPlan?: "" | "basic";
};

export default function SignupForm({ txRef = "", nextPath = "/portal", trialPlan = "" }: SignupFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const safeNext = nextPath.startsWith("/") ? nextPath : "/portal";
  const isBasicTrial = trialPlan === "basic";
  const loginHref = txRef
    ? `/account/login?tx_ref=${encodeURIComponent(txRef)}&next=${encodeURIComponent(safeNext)}`
    : `/account/login?next=${encodeURIComponent(safeNext)}`;

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
          payment_tx_ref: txRef || undefined,
          post_signup_path: safeNext,
          trial_plan: isBasicTrial ? "basic" : undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || "Unable to create account.");
        return;
      }

      if (result.requires_email_confirmation) {
        const verify = new URL("/account/verify-email", window.location.origin);
        verify.searchParams.set("email", email);
        if (txRef) verify.searchParams.set("tx_ref", txRef);
        if (safeNext) verify.searchParams.set("next", safeNext);
        router.push(`${verify.pathname}${verify.search}`);
        return;
      }

      const destination = new URL(result.redirect_to || safeNext, window.location.origin);
      if (txRef && safeNext === "/onboarding") destination.searchParams.set("tx_ref", txRef);
      router.push(`${destination.pathname}${destination.search}`);
      router.refresh();
    } catch {
      setError("We could not connect to the account service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="admin-login-card">
      <div className="admin-login-icon"><Building2 size={22} /></div>
      <div>
        <p className="admin-kicker">{isBasicTrial ? "Fluxknight Basic · Free Trial" : "Fluxknight Client Portal"}</p>
        <h1>{isBasicTrial ? "Start your Basic free trial" : "Create your workspace"}</h1>
        <p className="admin-muted">{isBasicTrial ? "Create your company workspace and owner access. No payment is required to start the Basic trial." : "Create your company account and owner access."}</p>
      </div>
      {txRef ? <p className="admin-form-message">Payment confirmed. Create your account to continue to onboarding.</p> : null}
      {isBasicTrial ? <p className="admin-form-message">Basic trial workspace · payment is not collected on this signup screen.</p> : null}
      <label>Full name<input name="full_name" required minLength={2} autoComplete="name" /></label>
      <label>Company name<input name="company_name" required minLength={2} autoComplete="organization" /></label>
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Creating workspace..." : isBasicTrial ? "Start Free Trial" : "Create account"}</button>
      <p className="admin-muted">Already registered? <Link href={loginHref}>Sign in</Link></p>
    </form>
  );
}
