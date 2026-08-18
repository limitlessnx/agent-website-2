"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MailCheck } from "@/components/admin/ServerIcons";

const COOLDOWN_SECONDS = 60;

export default function VerifyEmailClient({ email, txRef = "", nextPath = "/portal" }: { email: string; txRef?: string; nextPath?: string }) {
  const [seconds, setSeconds] = useState(COOLDOWN_SECONDS);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const safeNext = nextPath.startsWith("/") ? nextPath : "/portal";
  const loginHref = txRef ? `/account/login?tx_ref=${encodeURIComponent(txRef)}&next=${encodeURIComponent(safeNext)}` : "/account/login";

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  async function resend() {
    if (!email || seconds > 0 || sending) return;
    setSending(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/client-auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to resend email.");
      setMessage("Verification email sent."); setSeconds(COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend email.");
    } finally { setSending(false); }
  }

  return (
    <div className="admin-login-card">
      <div className="admin-login-icon"><MailCheck size={22} /></div>
      <div>
        <p className="admin-kicker">Email verification</p>
        <h1>Check your inbox</h1>
        <p className="admin-muted">We sent a link to</p>
        <strong>{email || "your email"}</strong>
      </div>
      {txRef ? <p className="admin-form-message">Your payment is secured. Verify your email, then sign in to continue to onboarding.</p> : null}
      {message ? <p className="admin-form-message">{message}</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="button" onClick={resend} disabled={seconds > 0 || sending || !email}>{sending ? "Sending..." : seconds > 0 ? `Resend in ${seconds}s` : "Resend email"}</button>
      <p className="admin-muted"><Link href={loginHref}>Go to sign in</Link></p>
    </div>
  );
}
