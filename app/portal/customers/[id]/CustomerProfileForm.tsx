"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Profile = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  status: string;
  profile?: Record<string, unknown> | null;
};

export default function CustomerProfileForm({ customer, canManage }: { customer: Profile & { id: string }; canManage: boolean }) {
  const router = useRouter();
  const profile = customer.profile || {};
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(formData: FormData) {
    setBusy(true);
    setMessage("");
    setError("");
    const payload = {
      fullName: String(formData.get("fullName") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      companyName: String(formData.get("companyName") || ""),
      status: String(formData.get("status") || "active"),
      notes: String(formData.get("notes") || ""),
      preferredChannel: String(formData.get("preferredChannel") || ""),
      timezone: String(formData.get("timezone") || ""),
      serviceInterest: String(formData.get("serviceInterest") || ""),
    };
    try {
      const response = await fetch("/api/portal/customers/" + customer.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save client profile.");
      setMessage("Client profile saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save client profile.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="portal-form-grid" action={save}>
    <div className="portal-field"><label htmlFor="client-full-name">Client name</label><input id="client-full-name" name="fullName" defaultValue={customer.full_name || ""} maxLength={160} disabled={!canManage || busy} /></div>
    <div className="portal-field"><label htmlFor="client-company-name">Company name</label><input id="client-company-name" name="companyName" defaultValue={customer.company_name || ""} maxLength={180} disabled={!canManage || busy} /></div>
    <div className="portal-field"><label htmlFor="client-email">Email</label><input id="client-email" name="email" type="email" defaultValue={customer.email || ""} maxLength={254} disabled={!canManage || busy} /></div>
    <div className="portal-field"><label htmlFor="client-phone">Phone / WhatsApp</label><input id="client-phone" name="phone" type="tel" defaultValue={customer.phone || ""} maxLength={40} disabled={!canManage || busy} /></div>
    <div className="portal-field"><label htmlFor="client-status">Client status</label><select id="client-status" name="status" defaultValue={customer.status || "active"} disabled={!canManage || busy}><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option><option value="archived">Archived</option></select></div>
    <div className="portal-field"><label htmlFor="client-contact-channel">Preferred contact channel</label><select id="client-contact-channel" name="preferredChannel" defaultValue={String(profile.preferred_channel || "")} disabled={!canManage || busy}><option value="">Not specified</option><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="email">Email</option><option value="sms">SMS</option></select></div>
    <div className="portal-field"><label htmlFor="client-timezone">Timezone</label><input id="client-timezone" name="timezone" defaultValue={String(profile.timezone || "")} placeholder="Africa/Lagos" maxLength={80} disabled={!canManage || busy} /></div>
    <div className="portal-field"><label htmlFor="client-service-interest">Service / package interest</label><input id="client-service-interest" name="serviceInterest" defaultValue={String(profile.service_interest || "")} maxLength={180} disabled={!canManage || busy} /></div>
    <div className="portal-field" style={{ gridColumn: "1 / -1" }}><label htmlFor="client-notes">Client notes</label><textarea id="client-notes" name="notes" defaultValue={String(profile.notes || "")} rows={4} maxLength={4000} disabled={!canManage || busy} placeholder="Preferences, requirements, important context..." /></div>
    {error ? <p role="alert" style={{ gridColumn: "1 / -1" }}>{error}</p> : null}
    {message ? <p role="status" style={{ gridColumn: "1 / -1" }}>{message}</p> : null}
    {canManage ? <div style={{ gridColumn: "1 / -1" }}><button type="submit" disabled={busy}>{busy ? "Saving..." : "Save client profile"}</button></div> : <p>You have view-only access to this client.</p>}
  </form>;
}
