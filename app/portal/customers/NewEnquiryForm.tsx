"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewEnquiryForm({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/portal/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: String(formData.get("fullName") || ""),
          email: String(formData.get("email") || ""),
          phone: String(formData.get("phone") || ""),
          source: String(formData.get("source") || "manual"),
          serviceInterest: String(formData.get("serviceInterest") || ""),
          summary: String(formData.get("summary") || ""),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save enquiry.");
      setMessage(result.reusedExistingClient ? "Enquiry added to the existing client record." : "Client and enquiry created.");
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save enquiry.");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) return null;

  return <section className="portal-card">
    <div className="portal-card-head"><div><h2>Capture a new enquiry</h2><p>Create an enquiry and link it to an existing client when the contact details match.</p></div><button type="button" onClick={() => setOpen((value) => !value)}>{open ? "Close form" : "New enquiry"}</button></div>
    {message ? <p role="status">{message}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {open ? <form className="portal-form-grid" action={submit}>
      <div className="portal-field"><label htmlFor="enquiry-name">Client name</label><input id="enquiry-name" name="fullName" required maxLength={160} disabled={busy} /></div>
      <div className="portal-field"><label htmlFor="enquiry-phone">Phone / WhatsApp</label><input id="enquiry-phone" name="phone" type="tel" maxLength={40} disabled={busy} /></div>
      <div className="portal-field"><label htmlFor="enquiry-email">Email</label><input id="enquiry-email" name="email" type="email" maxLength={254} disabled={busy} /></div>
      <div className="portal-field"><label htmlFor="enquiry-source">Enquiry source</label><select id="enquiry-source" name="source" defaultValue="manual" disabled={busy}><option value="manual">Walk-in / manual</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="website">Website</option><option value="referral">Referral</option><option value="campaign">Campaign</option><option value="phone">Phone call</option></select></div>
      <div className="portal-field"><label htmlFor="enquiry-interest">Service / package interest</label><input id="enquiry-interest" name="serviceInterest" maxLength={180} disabled={busy} placeholder="Portrait, wedding, maternity..." /></div>
      <div className="portal-field" style={{ gridColumn: "1 / -1" }}><label htmlFor="enquiry-summary">Enquiry notes</label><textarea id="enquiry-summary" name="summary" rows={3} maxLength={2000} disabled={busy} placeholder="What does the client need? Preferred date, requirements, budget..." /></div>
      <div style={{ gridColumn: "1 / -1" }}><button type="submit" disabled={busy}>{busy ? "Saving enquiry..." : "Save enquiry"}</button></div>
    </form> : null}
  </section>;
}
