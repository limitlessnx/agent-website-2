"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton from "../GoogleAuthButton";
import PasswordField from "../PasswordField";

type SignupFormProps = {
  txRef?: string;
  nextPath?: string;
  invitationToken?: string;
};

export default function SignupForm({ txRef = "", nextPath = "/portal", invitationToken = "" }: SignupFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestedNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/portal";
  const safeNext = invitationToken ? requestedNext : "/onboarding";
  const loginUrl = new URL("/account/login", "https://fluxknight.local");
  if (txRef) loginUrl.searchParams.set("tx_ref", txRef);
  loginUrl.searchParams.set("next", safeNext);
  if (invitationToken) loginUrl.searchParams.set("invitation_token", invitationToken);
  const loginHref = `${loginUrl.pathname}${loginUrl.search}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = new FormData(event.currentTarget);
      const password = String(data.get("password") || "");
      const passwordConfirmation = String(data.get("password_confirmation") || "");
      if (password !== passwordConfirmation) {
        setError("Passwords do not match.");
        return;
      }

      const email = String(data.get("email") || "").trim().toLowerCase();
      const response = await fetch("/api/client-auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: data.get("full_name"),
          email,
          password,
          password_confirmation: passwordConfirmation,
          payment_tx_ref: txRef || undefined,
          post_signup_path: safeNext,
          invitation_token: invitationToken || undefined,
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

      const destination = new URL(result.redirect_to || (result.requires_account_mode_selection ? "/account/choose-mode" : safeNext), window.location.origin);
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
      <div>
        <h1>Create your Fluxknight account</h1>
        <p className="admin-muted">Create your account and set up your Fluxknight workspace.</p>
      </div>
      {txRef ? <p className="admin-form-message">Payment confirmed. Create your account to continue.</p> : null}
      <GoogleAuthButton nextPath={invitationToken ? safeNext : "/onboarding"} label="Create account with Google" txRef={txRef} trialPlan="" invitationToken={invitationToken} />
      <p className="admin-muted">or create your account with email</p>
      <label>Full name<input name="full_name" required minLength={2} autoComplete="name" /></label>
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <PasswordField name="password" label="Password" autoComplete="new-password" minLength={8} />
      <PasswordField name="password_confirmation" label="Confirm password" autoComplete="new-password" minLength={8} />
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
      <p className="admin-muted">Already have an account? <Link href={loginHref}>Sign in</Link></p>
    </form>
  );
}
