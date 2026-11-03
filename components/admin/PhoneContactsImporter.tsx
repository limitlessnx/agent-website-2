"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function decodeVCardValue(value: string, params: string[]) {
  let decoded = value;
  if (params.some((param) => /ENCODING=(?:QUOTED-PRINTABLE|QP)/i.test(param))) {
    const bytes: number[] = [];
    for (let index = 0; index < decoded.length; index += 1) {
      if (decoded[index] === "=" && /^[0-9A-F]{2}$/i.test(decoded.slice(index + 1, index + 3))) {
        bytes.push(parseInt(decoded.slice(index + 1, index + 3), 16));
        index += 2;
      } else {
        bytes.push(decoded.charCodeAt(index) & 0xff);
      }
    }
    try { decoded = new TextDecoder("utf-8").decode(new Uint8Array(bytes)); } catch { /* retain readable source value */ }
  }
  return decoded
    .replace(/\\[nN]/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseVCard(source: string): PreviewContact[] {
  // vCard permits folded lines and optional group prefixes (for example item1.TEL).
  const unfolded = source
    .replace(/^\\uFEFF/, "")
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .replace(/\r(?=[^\n])/g, "\n");
  return unfolded.split(/(?=BEGIN:VCARD)/i)
    .filter((card) => /BEGIN:VCARD/i.test(card))
    .map((card) => {
      const lines = card.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const properties = lines.flatMap((line) => {
        const colon = line.indexOf(":");
        if (colon < 0) return [];
        const left = line.slice(0, colon);
        const value = line.slice(colon + 1);
        const parts = left.split(";");
        const property = (parts.shift() || "").split(".").pop()?.toUpperCase() || "";
        return [{ property, params: parts, value }];
      });
      const values = (property: string) => properties.filter((item) => item.property === property);
      const fn = values("FN")[0];
      const n = values("N")[0];
      const name = fn
        ? decodeVCardValue(fn.value, fn.params)
        : n
          ? decodeVCardValue((() => { const [family, given, middle, prefix, suffix] = n.value.split(";"); return [prefix, given, middle, family, suffix].filter(Boolean).join(" "); })(), n.params)
          : "";
      const phones = values("TEL").map((item) => ({
        value: decodeVCardValue(item.value, item.params),
        preferred: item.params.some((param) => /TYPE=.*(?:CELL|MOBILE)/i.test(param)) || item.params.some((param) => /PREF/i.test(param)),
      })).filter((item) => item.value);
      const phone = (phones.find((item) => item.preferred) || phones[0])?.value || "";
      const emailItem = values("EMAIL")[0];
      const email = emailItem ? decodeVCardValue(emailItem.value, emailItem.params) : "";
      return { name, phone, email };
    })
    .filter((contact) => contact.name && contact.phone);
}

export default function PhoneContactsImporter() {
  const picker = (typeof navigator !== "undefined" ? navigator as ContactPickerNavigator : null)?.contacts;
  const [supported, setSupported] = useState(false);
  useEffect(() => { setSupported(Boolean((navigator as ContactPickerNavigator).contacts?.select)); }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<PreviewContact[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [whatsappConsentConfirmed, setWhatsappConsentConfirmed] = useState(false);

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
      const allParsed = parseVCard(await file.text());
      const parsed = allParsed.slice(0, 500);
      setContacts(parsed);
      setSelected(parsed.map((_, index) => index));
      if (!parsed.length) setError("No contacts with a name and phone number were found in that VCF file.");
      else if (allParsed.length > 500) setNotice("Showing the first 500 contacts. Import them in batches.");
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
        body: JSON.stringify({ contacts: selectedContacts, whatsappConsentConfirmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Contact import failed.");
      setNotice(data.imported + " new lead(s) added; " + data.skipped + " skipped. " + (data.campaignEligible ? "They are marked campaign-eligible based on your consent confirmation." : "They are saved as leads but excluded from campaigns until consent is confirmed."));
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
        {supported ? (
          <button type="button" onClick={chooseFromPhone} disabled={loading || importing}>
            {loading ? "Opening contacts…" : "Choose phone contacts"}
          </button>
        ) : (
          <button type="button" className={styles.unavailable} disabled aria-describedby="contact-picker-unavailable">
            Phone picker unavailable on iPhone
          </button>
        )}
        <button type="button" className={supported ? styles.secondary : styles.primaryFallback} onClick={() => fileRef.current?.click()} disabled={loading || importing}>
          Choose .vcf contact file
        </button>
        <input ref={fileRef} className={styles.hiddenFile} type="file" accept=".vcf,.vcard,text/vcard,text/x-vcard,application/vcard" onChange={(event) => void readVCard(event.target.files?.[0])} />
      </div>

      {!supported ? (
        <div className={styles.fallbackHelp}>
          <p className={styles.hint}>Direct address-book access is restricted in iPhone browsers. You can still choose and review contacts using a vCard file.</p>
          <details className={styles.instructions}>
            <summary>How to export contacts on iPhone</summary>
            <ol>
              <li>Open the Contacts app and select the contact or contacts you want to share.</li>
              <li>Tap Share Contact, then save or share the contact card as a .vcf file.</li>
              <li>Return here, tap “Choose .vcf contact file”, and select the saved file.</li>
              <li>Review the contacts and confirm the ones you want to add as leads.</li>
            </ol>
          </details>
        </div>
      ) : <p className={styles.hint}>Your browser will ask you to choose contacts. Limitless Realty receives only the contacts you select, not your full address book.</p>}

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
          <label className={styles.consentCheck}><input type="checkbox" checked={whatsappConsentConfirmed} onChange={(event) => setWhatsappConsentConfirmed(event.target.checked)} /><span>I confirm these contacts have given permission to receive WhatsApp marketing messages. Without this confirmation, imported leads will be excluded from campaigns.</span></label>
          <button type="button" className={styles.importButton} onClick={importSelected} disabled={!selected.length || importing}>
            {importing ? "Adding leads…" : "Add " + selected.length + " selected to Leads"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
