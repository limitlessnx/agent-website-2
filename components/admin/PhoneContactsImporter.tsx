"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./PhoneContactsImporter.module.css";

type DeviceContact = { name?: string[]; tel?: string[]; email?: string[] };
type ContactPickerNavigator = Navigator & {
  contacts?: {
    select: (properties: string[], options?: { multiple?: boolean }) => Promise<DeviceContact[]>;
  };
};

type PreviewContact = { name: string; phone: string; email?: string };

function first(value?: string[]) {
  return String(value?.find((item) => item?.trim()) || "").trim();
}

function parseVCard(source: string): PreviewContact[] {
  const unfolded = source.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  return unfolded.split(/(?=BEGIN:VCARD)/i).filter((card) => /BEGIN:VCARD/i.test(card)).map((card) => {
    const lines = card.split(/\r?\n/);
    const read = (prefix: string) => {
      const line = lines.find((item) => item.toUpperCase().startsWith(prefix));
      return line ? line.slice(line.indexOf(":") + 1).trim().replace(/\\[nN]/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";") : "";
    };
    const name = read("FN:") || read("N:");
    const phone = lines.find((item) => /^TEL(?:;[^:]*)?:/i.test(item))?.split(":").slice(1).join(":").trim() || "";
    const email = lines.find((item) => /^EMAIL(?:;[^:]*)?:/i.test(item))?.split(":").slice(1).join(":").trim() || "";
    return { name, phone, email };
  }).filter((contact) => contact.name && contact.phone);
}

export default function PhoneContactsImporter() {
  const picker = (typeof navigator !== "undefined" ? navigator as ContactPickerNavigator : null)?.contacts;
  const supported = Boolean(picker?.select);
  const fileRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<PreviewContact[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedContacts = useMemo(() => selected.map((index) => contacts[index]).filter(Boolean), [contacts, selected]);

  async function chooseFromPhone() {
    setError("");
    setNotice("");
    if (!picker?.select) {
      setError("Direct contact selection is not supported by this browser. Use the .vcf contact-file option below.");
      return;
    }
    setLoading(true);
    try {
      // The browser opens its native contact chooser only after this explicit user action.
      const chosen = await picker.select(["name", "tel", "email"], { multiple: true });
      const normalized = chosen.map((contact) => ({
        name: first(contact.name),
        phone: first(contact.tel),
        email: first(contact.email) || undefined,
      })).filter((contact) => contact.name && contact.phone);
      setContacts(normalized);
      setSelected(normalized.map((_, index) => index));
      if (!normalized.length) setNotice("No contacts with both a name and phone number were selected.");
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Unable to read selected phone contacts.");
    } finally {
      setLoading(false);
    }
  }

  async function readVCard(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const parsed = parseVCard(await file.text()).slice(0, 500);
      setContacts(parsed);
      setSelected(parsed.map((_, index) => index));
      if (!parsed.length) setError("No contacts with a name and phone number were found in that VCF file.");
      else if (parseVCard(await file.text()).length > 500) setNotice("Showing the first 500 contacts. Import them in batches.");
    } catch {
      setError("Unable to read this contact file. Export it again as a .vcf file and retry.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggle(index: number) {
    setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  }

  async function importSelected() {
    if (!selectedContacts.length) return;
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/limitless/leads/phone-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: selectedContacts }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Contact import failed.");
      setNotice(data.imported + " new lead(s) added; " + data.skipped + " skipped as duplicates or invalid contacts.");
      setContacts([]);
      setSelected([]);
      window.dispatchEvent(new CustomEvent("limitless-leads-imported"));
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Contact import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="phone-contacts-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CONTACT IMPORT</span>
          <h2 id="phone-contacts-title">Add leads from your phone</h2>
          <p>Choose contacts from your device, review the list, then import only the people you select.</p>
        </div>
        <span className={styles.deviceIcon} aria-hidden="true">⌕</span>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={chooseFromPhone} disabled={!supported || loading || importing}>
          {loading ? "Opening contacts…" : "Choose phone contacts"}
        </button>
        <button type="button" className={styles.secondary} onClick={() => fileRef.current?.click()} disabled={loading || importing}>
          Import .vcf file
        </button>
        <input ref={fileRef} className={styles.hiddenFile} type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={(event) => void readVCard(event.target.files?.[0])} />
      </div>

      {!supported ? <p className={styles.hint}>This browser does not support the native contact picker. On iPhone or unsupported browsers, export/share contacts as a .vcf file and import that file here.</p> : <p className={styles.hint}>Your browser will ask you to choose contacts. Limitless Realty receives only the contacts you select, not your full address book.</p>}

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {contacts.length > 0 ? (
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <div><strong>Review selected contacts</strong><span>{selected.length} of {contacts.length} selected</span></div>
            <button type="button" className={styles.textButton} onClick={() => setSelected(selected.length === contacts.length ? [] : contacts.map((_, index) => index))}>{selected.length === contacts.length ? "Clear all" : "Select all"}</button>
          </div>
          <div className={styles.contactList}>
            {contacts.map((contact, index) => (
              <label key={index} className={styles.contact}>
                <input type="checkbox" checked={selected.includes(index)} onChange={() => toggle(index)} />
                <span className={styles.contactCopy}><strong>{contact.name}</strong><small>{contact.phone}{contact.email ? " · " + contact.email : ""}</small></span>
              </label>
            ))}
          </div>
          <button type="button" className={styles.importButton} onClick={importSelected} disabled={!selected.length || importing}>
            {importing ? "Adding leads…" : "Add " + selected.length + " selected to Leads"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
