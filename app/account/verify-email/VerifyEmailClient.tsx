"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FluxknightLogo from "@/components/admin/FluxknightLogo";

const COOLDOWN_SECONDS = 60;

export default function VerifyEmailClient({ email }: { email: string }) {
  const [seconds, setSeconds] = useState(COOLDOWN_SECONDS);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  async function resend() {
    if (!email || seconds > 0 || sending) return;
    setSending(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/client-auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to resend email.");
      setMessage("Verification email sent.");
      setSeconds(COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="admin-login-card">
      <div className="admin-login-icon"><FluxknightLogo compact priority /></div>
      <div>
        <p className="admin-kicker">Email verification</p>
        <h1>Check your inbox</h1>
        <p className="admin-muted">We sent a link to</p>
        <strong>{email || "your email"}</strong>
      </div>
      {message ? <p className="admin-form-message">{message}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="button" onClick={resend} disabled={seconds > 0 || sending || !email}>
        {sending ? "Sending..." : seconds > 0 ? `Resend in ${seconds}s` : "Resend email"}
      </button>
      <p className="admin-muted"><Link href="/account/login">Go to sign in</Link></p>
    </div>
  );
}
