"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.message || "Login failed.");
      return;
    }
    router.push(searchParams.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="admin-login-card">
      <div className="admin-login-icon">
        <LockKeyhole size={22} />
      </div>
      <div>
        <p className="admin-kicker">Limitless Realty Backend</p>
        <h1>Admin Login</h1>
        <p className="admin-muted">Sign in to control leads, properties, campaigns, follow-ups, and automation systems.</p>
      </div>
      <label>
        Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
      </label>
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
    </form>
  );
}
