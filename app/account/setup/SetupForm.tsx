"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "@/components/admin/ServerIcons";

export default function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/client-auth/setup-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: data.get("company_name") }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || "Unable to finish workspace setup.");
        return;
      }

      router.push(String(result.redirect_to || "/portal"));
      router.refresh();
    } catch {
      setError("We could not connect to the workspace service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="admin-login-card">
      <div className="admin-login-icon"><Building2 size={22} /></div>
      <div>
        <p className="admin-kicker">Fluxknight Client Portal</p>
        <h1>Welcome to your workspace</h1>
        <p className="admin-muted">Tell us who you are and what your organization is called. You can complete business details, knowledge, and WhatsApp setup from the dashboard.</p>
      </div>
      <label>Your name<input name="full_name" required minLength={2} autoComplete="name" placeholder="e.g. Ada Okafor" /></label>
      <label>Organization name<input name="company_name" required minLength={2} autoComplete="organization" placeholder="e.g. Haven Homes" /></label>
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Opening workspace..." : "Create workspace & open dashboard"}</button>
    </form>
  );
}
