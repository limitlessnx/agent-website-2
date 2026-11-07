"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { parseVCard } from "@/lib/campaign-vcard";
import { validateCampaignContacts } from "@/lib/campaign-phone-contacts";
import styles from "./XposureCampaigns.module.css";

export type CampaignContact = { id: string; full_name: string; phone: string | null; whatsapp_consent: string };
type Draft = { name: string; phone: string; selected: boolean };
type ContactNavigator = Navigator & { contacts?: { select: (fields: string[], options: { multiple: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>> } };
const subscribe = () => () => {};
const pickerSupported = () => Boolean((navigator as ContactNavigator).contacts?.select);

export default function CampaignContactImport({ onImported }: { onImported: (contacts: CampaignContact[]) => void }) {
  const supported = useSyncExternalStore(subscribe, pickerSupported, () => false);
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = drafts.filter(contact => contact.selected);

  function review(contacts: Array<{ name: string; phone: string }>) {
    if (contacts.length + drafts.length > 500) throw new Error("Choose up to 500 contacts at a time. Save this batch before adding more.");
    if (!contacts.length) throw new Error("No contacts with a name and phone number were found.");
    setDrafts(current => [...current, ...contacts.map(contact => ({ name: contact.name, phone: contact.phone, selected: true }))]);
    setConsent(false); setNotice("");
  }
  function addManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    try {
      const parsed = validateCampaignContacts([{ name, phone }]);
      if (drafts.length >= 500) throw new Error("Save this batch before adding more contacts.");
      setDrafts(current => [...current, { ...parsed.contacts[0], selected: true }]);
      setName(""); setPhone(""); setConsent(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Check the contact details."); }
  }
  async function choosePhone() {
    setError(""); setBusy(true);
    try {
      const picker = (navigator as ContactNavigator).contacts;
      if (!picker) throw new Error("Use a .vcf contact file in this browser.");
      const contacts = await picker.select(["name", "tel"], { multiple: true });
      if (contacts.length) review(contacts.map(contact => ({ name: contact.name?.[0] || "", phone: contact.tel?.[0] || "" })));
    } catch (reason) { if (!(reason instanceof Error && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Unable to open phone contacts."); }
    finally { setBusy(false); }
  }
  async function readFile(value?: File) {
    if (!value) return;
    setError(""); setBusy(true);
    try {
      if (value.size > 2 * 1024 * 1024) throw new Error("Choose a contact file smaller than 2 MB.");
      review(parseVCard(await value.text()));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to read this contact file."); }
    finally { setBusy(false); if (file.current) file.current.value = ""; }
  }
  async function save() {
    setError(""); setNotice(""); setBusy(true);
    try {
      const parsed = validateCampaignContacts(selected);
      const response = await fetch("/api/portal/campaigns/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacts: parsed.contacts, whatsappConsentConfirmed: consent }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save contacts.");
      onImported(payload.contacts || []);
      setNotice(`${payload.imported} contact${payload.imported === 1 ? "" : "s"} added.${parsed.duplicates ? ` ${parsed.duplicates} duplicate number(s) removed.` : ""}${consent ? "" : " Saved without marketing permission; excluded from campaigns."}`);
      setDrafts([]); setConsent(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save contacts."); }
    finally { setBusy(false); }
  }
  return <section className={styles.card} aria-labelledby="campaign-import-heading">
    <div className={styles.heading}><div><p className={styles.eyebrow}>Contact book</p><h2 id="campaign-import-heading">Add contacts from your phone</h2><p>Add a number or choose contacts to review before saving.</p></div></div>
    <form onSubmit={addManual} className={styles.manual}>
      <label>Name<input value={name} onChange={event => setName(event.target.value)} autoComplete="off" maxLength={180} required disabled={busy} /></label>
      <label>Phone with country code<input type="tel" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+ country code and number" autoComplete="off" required disabled={busy} /></label>
      <button type="submit" className={styles.secondary} disabled={busy}>Add to review</button>
    </form>
    <div className={styles.importActions}>
      <button type="button" className={styles.secondary} onClick={() => void choosePhone()} disabled={!supported || busy}>Choose phone contacts</button>
      <button type="button" className={styles.secondary} onClick={() => file.current?.click()} disabled={busy}>Import .vcf file</button>
      <input ref={file} type="file" accept=".vcf,.vcard,text/vcard,text/x-vcard" aria-label="Choose a vCard contact file" className={styles.hidden} onChange={event => void readFile(event.target.files?.[0])} />
    </div>
    <p className={styles.hint}>{supported ? "Only the contacts you choose are shared with Xposure." : "Phone picker unavailable in this browser. On iPhone, share contacts from the Contacts app, save the .vcf file, then import it here."}</p>
    {drafts.length > 0 && <div className={styles.review}>
      <div className={styles.heading}><h3>Review contacts</h3><span>{selected.length} selected</span></div>
      <p className={styles.hint}>Check each country code. Saving contacts does not send a campaign.</p>
      <div className={styles.draftList}>{drafts.map((contact, index) => <div className={styles.draft} key={index}>
        <input type="checkbox" aria-label={`Import contact ${index + 1}`} checked={contact.selected} disabled={busy} onChange={event => { setConsent(false); setDrafts(current => current.map((item, i) => i === index ? { ...item, selected: event.target.checked } : item)); }} />
        <label><span className={styles.hidden}>Name for contact {index + 1}</span><input value={contact.name} disabled={busy} onChange={event => { setConsent(false); setDrafts(current => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item)); }} /></label>
        <label><span className={styles.hidden}>Phone for contact {index + 1}</span><input type="tel" value={contact.phone} disabled={busy} onChange={event => { setConsent(false); setDrafts(current => current.map((item, i) => i === index ? { ...item, phone: event.target.value } : item)); }} /></label>
      </div>)}</div>
      <label className={styles.consent}><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>I confirm every selected contact has agreed to receive WhatsApp marketing messages from Xposure. Without this confirmation, contacts are saved but excluded from campaigns.</span></label>
      <button type="button" className={styles.primary} onClick={() => void save()} disabled={busy || !selected.length}>{busy ? "Saving contacts…" : `Save ${selected.length} contact${selected.length === 1 ? "" : "s"}`}</button>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.success} role="status">{notice}</p>}
  </section>;
}
