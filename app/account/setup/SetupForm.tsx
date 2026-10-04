"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "@/components/admin/ServerIcons";
import { industries } from "@/lib/industryCatalog";

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
        body: JSON.stringify({ company_name: data.get("company_name"), industry_slug: data.get("industry_slug") }),
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
        <h1>Finish your workspace</h1>
        <p className="admin-muted">Your account is ready. Choose your industry and create the workspace that will shape your dashboard.</p>
      </div>
      <label>Company name<input name="company_name" required minLength={2} autoComplete="organization" /></label>
      <label>Industry<select name="industry_slug" required defaultValue=""><option value="" disabled>Select your industry</option>{industries.map((industry) => <option key={industry.slug} value={industry.slug}>{industry.name}</option>)}</select></label>
      {error ? <p className="admin-error">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Creating workspace..." : "Create workspace & continue"}</button>
    </form>
  );
}
