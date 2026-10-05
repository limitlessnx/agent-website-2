"use client";

import { useMemo, useState } from "react";
import type { ProgressiveLead } from "@/lib/lead-profile-service";

type ContactPickerProps = { contacts: ProgressiveLead[] };

export default function ContactPicker({ contacts }: ContactPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const selected = contacts.find((contact) => String(contact.id) === selectedId);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts.slice(0, 8);
    return contacts.filter((contact) =>
      [contact.name, contact.phone, contact.email, contact.property_interest]
        .some((value) => String(value || "").toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [contacts, query]);

  return (
    <div className="contact-picker">
      <label>
        Existing contact
        <input type="search" value={query}
          onChange={(event) => { setQuery(event.target.value); setSelectedId(""); }}
          placeholder="Search contact by name, phone or email..." autoComplete="off" />
      </label>
      {matches.length ? (
        <div className="contact-picker-results" role="listbox" aria-label="Matching contacts">
          {matches.map((contact) => (
            <button key={contact.id} type="button"
              className={String(contact.id) === selectedId ? "contact-picker-result selected" : "contact-picker-result"}
              onClick={() => { setSelectedId(String(contact.id)); setQuery(contact.name || contact.phone || ""); }}>
              <strong>{contact.name || "Unnamed contact"}</strong>
              <span>{contact.phone || "No phone"}{contact.email ? ` · ${contact.email}` : ""}</span>
            </button>
          ))}
        </div>
      ) : query.trim() ? (
        <p className="admin-form-help">No existing lead matches. You can enter a new contact below.</p>
      ) : null}
      <input type="hidden" name="contact_id" value={selectedId} />
      <input type="hidden" name="client_name" value={selected?.name || ""} />
      <input type="hidden" name="client_phone" value={selected?.phone || ""} />
      <input type="hidden" name="client_email" value={selected?.email || ""} />
      <p className="admin-form-help">Select an existing lead to fill the client details automatically. You can still enter a new client manually below.</p>
    </div>
  );
}
