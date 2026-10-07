"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton from "../GoogleAuthButton";
import PasswordField from "../PasswordField";

export default function ClientLoginForm({ txRef = "", nextPath = "/portal", invitationToken = "" }: { txRef?: string; nextPath?: string; invitationToken?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [loading, setLoading] = useState(false);

  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/portal";
  const signupUrl = new URL("/account/signup", "https://fluxknight.local");
  if (txRef) signupUrl.searchParams.set("tx_ref", txRef);
  signupUrl.searchParams.set("next", safeNext);
  if (invitationToken) signupUrl.searchParams.set("invitation_token", invitationToken);
  const signupHref = `${signupUrl.pathname}${signupUrl.search}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setErrorCode("");

    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/client-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password"), invitation_token: invitationToken || undefined }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || "Unable to sign in.");
        setErrorCode(result.code || "");
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
      <div>
        <h1>Welcome back</h1>
        <p className="admin-muted">Sign in to your Fluxknight account to continue.</p>
      </div>
      {txRef ? <p className="admin-form-message">Your payment is verified. Sign in to continue to onboarding.</p> : null}
      <GoogleAuthButton nextPath={safeNext} txRef={txRef} invitationToken={invitationToken} />
      <p className="admin-muted">or continue with email</p>
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <PasswordField name="password" label="Password" autoComplete="current-password" />
      <div className="auth-inline-row"><Link href={`/account/forgot-password?next=${encodeURIComponent(safeNext)}`}>Forgot password?</Link></div>
      {error ? <div className="admin-error" role="alert"><p>{error}</p>{errorCode === "account_not_found" ? <Link href={signupHref}>Continue to create an account</Link> : null}</div> : null}
      <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      <p className="admin-muted">New to Fluxknight? <Link href={signupHref}>Create an account</Link></p>
    </form>
  );
}
