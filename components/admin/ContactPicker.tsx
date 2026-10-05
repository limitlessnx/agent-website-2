"use client";

import { useMemo, useState } from "react";
import type { ProgressiveLead } from "@/lib/lead-profile-service";

type ContactPickerProps = { contacts: ProgressiveLead[] };

export default function ContactPicker({ contacts }: ContactPickerProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const selected = contacts.find((contact) => String(contact.id) === selectedId);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = q
      ? contacts.filter((contact) =>
          [contact.name, contact.phone, contact.email, contact.property_interest]
            .some((value) => String(value || "").toLowerCase().includes(q)),
        )
      : contacts;
    return source.slice(0, 8);
  }, [contacts, query]);

  const selectExisting = (contact: ProgressiveLead) => {
    setSelectedId(String(contact.id));
    setQuery(contact.name || contact.phone || "");
    setMode("existing");
  };

  return (
    <section className="contact-picker" aria-label="Installment client contact">
      <div className="contact-picker-heading">
        <div>
          <span className="contact-picker-eyebrow">Client contact</span>
          <h3>Who is this installment plan for?</h3>
          <p>Use an existing Lead or create a new contact without leaving this form.</p>
        </div>
      </div>

      <div className="contact-picker-tabs" role="tablist" aria-label="Contact source">
        <button type="button" role="tab" aria-selected={mode === "existing"} className={mode === "existing" ? "contact-picker-tab active" : "contact-picker-tab"} onClick={() => setMode("existing")}>
          Existing Lead <span>{contacts.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === "new"} className={mode === "new" ? "contact-picker-tab active" : "contact-picker-tab"} onClick={() => { setMode("new"); setSelectedId(""); }}>
          + Add new contact
        </button>
      </div>

      {mode === "existing" ? (
        <div className="contact-picker-existing">
          <label className="contact-picker-search">
            <span>Search contacts</span>
            <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); }} placeholder="Search by name, phone or email…" autoComplete="off" />
          </label>

          {matches.length ? (
            <div className="contact-picker-results" role="listbox" aria-label="Matching contacts">
              {matches.map((contact) => {
                const isSelected = String(contact.id) === selectedId;
                return (
                  <button key={contact.id} type="button" role="option" aria-selected={isSelected} className={isSelected ? "contact-picker-result selected" : "contact-picker-result"} onClick={() => selectExisting(contact)}>
                    <span className="contact-picker-avatar">{(contact.name || "?").trim().slice(0, 1).toUpperCase()}</span>
                    <span className="contact-picker-result-copy">
                      <strong>{contact.name || "Unnamed contact"}</strong>
                      <span>{contact.phone || "No phone"}{contact.email ? " · " + contact.email : ""}</span>
                    </span>
                    <span className="contact-picker-check" aria-hidden="true">{isSelected ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="contact-picker-empty">
              <strong>No matching contact</strong>
              <span>Try another search or switch to “Add new contact”.</span>
              <button type="button" onClick={() => setMode("new")}>Add this contact manually</button>
            </div>
          )}

          {selected ? (
            <div className="contact-picker-selected">
              <span>Selected</span>
              <strong>{selected.name}</strong>
              <small>{selected.phone || selected.email || "Contact selected"}</small>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="contact-picker-new">
          <div className="contact-picker-new-copy">
            <strong>Create a new contact</strong>
            <span>The contact will be saved to Leads and linked to this installment plan.</span>
          </div>
          <div className="contact-picker-new-grid">
            <input name="client_name_manual" placeholder="Full name" autoComplete="name" required />
            <input name="client_phone_manual" placeholder="Phone / WhatsApp number" autoComplete="tel" required />
            <input name="client_email_manual" type="email" placeholder="Email address (optional)" autoComplete="email" />
          </div>
        </div>
      )}

      <input type="hidden" name="contact_id" value={selectedId} />
      <input type="hidden" name="client_name" value={selected?.name || ""} />
      <input type="hidden" name="client_phone" value={selected?.phone || ""} />
      <input type="hidden" name="client_email" value={selected?.email || ""} />
    </section>
  );
}
