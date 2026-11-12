"use client";

import { useEffect, useState } from "react";
import CampaignContactImport, { type CampaignContact } from "./CampaignContactImport";
import styles from "./XposureCampaigns.module.css";
import CampaignAiWriter from "@/components/CampaignAiWriter";

type Template = { name: string; language: string; category: string; purpose: string; variable_keys: string[]; body: string };
type Customer = { id: string; full_name: string; phone: string | null; email: string | null };
const keyFor = (template: Template) => `${template.purpose}:${template.name}:${template.language}`;
const digits = (phone: string | null) => (phone || "").replace(/\D/g, "");


// A single composer may only fill approved variable slots. Fixed Meta template text is immutable.
const escapeRegex = (value: string) => value.replace(/[^a-zA-Z0-9]/g, char => "\\" + char);
function mapApprovedMessage(template: Template, message: string): Record<string, string> | null {
  const parts = template.body.split(/(\{\{\s*\d+\s*\}\})/g);
  const captureKeys: string[] = [];
  let pattern = "^";
  for (const part of parts) {
    const match = /^\{\{\s*(\d+)\s*\}\}$/.exec(part);
    if (!match) { pattern += escapeRegex(part); continue; }
    const key = template.variable_keys[Number(match[1]) - 1];
    if (!key) return null;
    if (key === "customer_name") pattern += escapeRegex("{{customer_name}}");
    else { captureKeys.push(key); pattern += "([\\s\\S]*?)"; }
  }
  const result = new RegExp(pattern + "$").exec(message);
  if (!result) return null;
  const values: Record<string, string> = {};
  for (let i = 0; i < captureKeys.length; i++) {
    const value = result[i + 1]?.trim() || "";
    if (!value || value.length > 1024 || /\{\{/.test(value)) return null;
    if (values[captureKeys[i]] && values[captureKeys[i]] !== value) return null;
    values[captureKeys[i]] = value;
  }
  return values;
}
function messageSkeleton(template: Template) {
  return template.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, index: string) => {
    const key = template.variable_keys[Number(index) - 1];
    return key === "customer_name" ? "{{customer_name}}" : "";
  });
}

export default function XposureCampaignComposer({ customers, canManageContacts }: { customers: Customer[]; canManageContacts: boolean }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateError, setTemplateError] = useState("");
  const [contactError, setContactError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function loadTemplates() {
      try {
        const response = await fetch("/api/portal/campaigns/meta-templates", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to verify linked templates.");
        if (!controller.signal.aborted) {
          const available: Template[] = (payload.templates || []).filter((item: Template) => ["campaign", "customer_follow_up", "campaign_promotion"].includes(item.purpose));
          setTemplates(available); setTemplateKey(available[0] ? keyFor(available[0]) : ""); setMessageDraft(""); setTemplateError("");
        }
      } catch (reason) { if (!controller.signal.aborted) setTemplateError(reason instanceof Error ? reason.message : "Unable to load templates."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    async function loadContacts() {
      try {
        const response = await fetch("/api/portal/campaigns/contacts", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load contacts.");
        if (!controller.signal.aborted) { setContacts(payload.contacts || []); setContactError(""); }
      } catch (reason) { if (!controller.signal.aborted) setContactError(reason instanceof Error ? reason.message : "Unable to load contacts."); }
    }
    void Promise.all([loadTemplates(), loadContacts()]);
    return () => controller.abort();
  }, [reload]);
  const template = templates.find(item => keyFor(item) === templateKey);
  const importedPhones = new Set(contacts.map(contact => digits(contact.phone)).filter(Boolean));
  const audience = [
    ...contacts.map(contact => ({ ...contact, key: `contact:${contact.id}`, source: "contact" })),
    ...customers.filter(customer => !importedPhones.has(digits(customer.phone))).map(customer => ({ ...customer, whatsapp_consent: "unknown", key: `customer:${customer.id}`, source: "customer" })),
  ];
  const eligible = audience.filter(contact => contact.phone && contact.whatsapp_consent === "opted_in");
  const recipients = eligible.filter(contact => selected.includes(contact.key));
  const parsedVariables = template ? mapApprovedMessage(template, messageDraft) : null;
  const variables = parsedVariables ?? {};
  const complete = template && parsedVariables !== null
    && template.variable_keys.every(key => key === "customer_name" || variables[key]?.trim());
  const preview = template?.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, number) => {
    const key = template.variable_keys[Number(number) - 1];
    return key === "customer_name" ? recipients[0]?.full_name || "{{customer_name}}" : variables[key] || match;
  });
  function selectTemplate(value: string) { setTemplateKey(value); setMessageDraft(""); setReviewing(false); setNotice(""); }
  async function send() {
    if (!template || !recipients.length || !complete) return;
    setSending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/portal/campaigns/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        templateName: template.name, templatePurpose: template.purpose, languageCode: template.language, variables,
        contactIds: recipients.filter(contact => contact.source === "contact").map(contact => contact.id),
        customerIds: recipients.filter(contact => contact.source === "customer").map(contact => contact.id),
      }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Campaign request failed.");
      setNotice(`${payload.accepted} accepted by WhatsApp, ${payload.failed} failed, ${payload.skipped || 0} skipped.${payload.unknown ? ` ${payload.unknown} outcome(s) unknown; check provider records before sending again.` : ""} Acceptance does not confirm delivery.`);
      setSelected([]); setReviewing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Campaign request failed. Check the result before sending again."); }
    finally { setSending(false); }
  }
  return <div className={styles.workspace}>
    <div className={styles.columns}>
      <section className={styles.card} aria-labelledby="campaign-template-heading">
        <div className={styles.heading}><div><p className={styles.eyebrow}>WhatsApp campaign</p><h2 id="campaign-template-heading">Your linked template</h2><p>Templates linked to Xposure and approved by WhatsApp.</p></div>{template && <span className={styles.badge}>Approved</span>}</div>
        {loading && <p role="status">Checking linked templates…</p>}
        {templateError && <p className={styles.error} role="alert">{templateError}</p>}
        {!loading && !templateError && !templates.length && <p className={styles.hint}>No linked, approved campaign template is available. Ask your administrator to link a campaign or customer follow-up template.</p>}
        <label className={styles.field}>Linked template<select value={templateKey} disabled={sending || loading || !templates.length} onChange={event => selectTemplate(event.target.value)}><option value="" disabled>Choose a linked template</option>{templates.map(item => <option key={keyFor(item)} value={keyFor(item)}>{item.name} · {item.language}</option>)}</select></label>
        {template && <>
          <div className={styles.templateMeta}><span>{template.category || "WhatsApp template"}</span><span>{template.language}</span><span>Linked to Xposure</span></div>
          {parsedVariables && <div className={styles.message} aria-label="WhatsApp message preview"><span>Message preview</span><p>{preview}</p></div>}
          <div className={styles.fields}>
            <label className={styles.field}>Campaign message<textarea rows={6} value={messageDraft} maxLength={4000} disabled={sending} placeholder="Write or paste the message you want clients to receive." onChange={event => { setMessageDraft(event.target.value); setReviewing(false); }} aria-describedby="approved-message-hint" /></label>
            <p id="approved-message-hint" className={styles.hint}>{parsedVariables ? "Review the preview. Each client’s name is filled in automatically." : "Write your message, then choose Fit to WhatsApp template before reviewing the campaign."}</p>
            {!messageDraft && <button type="button" className={styles.secondary} disabled={sending} onClick={() => setMessageDraft(messageSkeleton(template))}>Start from template</button>}
          </div>
          <CampaignAiWriter key={templateKey} endpoint="/api/portal/campaigns/writeup" context={{ templateName: template.name, templatePurpose: template.purpose, language: template.language }} values={variables} message={messageDraft} disabled={sending || reviewing} onApply={suggested => { const next = template.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, index: string) => { const key = template.variable_keys[Number(index) - 1]; return key === "customer_name" ? "{{customer_name}}" : suggested[key] || variables[key] || ""; }); setMessageDraft(next); setReviewing(false); }} />
        </>}
        <div className={styles.sendbar}><div><strong>{recipients.length} recipient{recipients.length === 1 ? "" : "s"} selected</strong><small>Only contacts with marketing permission can be selected.</small></div><button type="button" className={styles.primary} onClick={() => { setReviewing(true); setNotice(""); setError(""); }} disabled={!complete || !recipients.length || sending || Boolean(contactError) || Boolean(templateError)}>Review campaign</button></div>
        {reviewing && <div className={styles.confirm} role="region" aria-label="Confirm campaign"><h3>Confirm your campaign</h3><p>Send <strong>{template?.name}</strong> to {recipients.length} selected contact{recipients.length === 1 ? "" : "s"}? Consent and template approval will be checked again.</p><div className={styles.importActions}><button type="button" className={styles.primary} onClick={() => void send()} disabled={sending}>{sending ? "Submitting…" : "Send campaign"}</button><button type="button" className={styles.secondary} disabled={sending} onClick={() => setReviewing(false)}>Cancel campaign</button></div></div>}
        {notice && <p className={styles.success} role="status">{notice}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
      </section>
      <section className={styles.card} aria-labelledby="campaign-audience-heading">
        <div className={styles.heading}><div><p className={styles.eyebrow}>Audience</p><h2 id="campaign-audience-heading">Studio contacts</h2><p>{eligible.length} eligible · {audience.length} total contacts</p></div><button type="button" className={styles.textButton} disabled={sending || !eligible.length} onClick={() => { setSelected(recipients.length === eligible.length ? [] : eligible.map(contact => contact.key)); setReviewing(false); }}>{recipients.length === eligible.length && eligible.length ? "Clear selection" : "Select eligible"}</button></div>
        {contactError && <p className={styles.error} role="alert">{contactError}</p>}
        <div className={styles.audience}>{audience.map(contact => <label className={styles.contact} key={contact.key}>
          <input type="checkbox" checked={selected.includes(contact.key)} disabled={sending || !contact.phone || contact.whatsapp_consent !== "opted_in"} onChange={event => { setSelected(current => event.target.checked ? [...current, contact.key] : current.filter(key => key !== contact.key)); setReviewing(false); }} />
          <span><strong>{contact.full_name}</strong><small>{contact.phone || "No phone number"}</small><small className={contact.whatsapp_consent === "opted_in" ? styles.optedIn : ""}>{contact.whatsapp_consent === "opted_in" ? "Marketing permission recorded" : contact.whatsapp_consent === "opted_out" ? "Opted out · excluded" : "No marketing permission · excluded"}</small></span>
        </label>)}</div>
        {!audience.length && !contactError && <p className={styles.empty}>No studio contacts yet. Add contacts below to build your audience.</p>}
        {(contactError || templateError) && <button type="button" className={styles.secondary} onClick={() => setReload(current => current + 1)}>Retry loading</button>}
      </section>
    </div>
    {canManageContacts ? <CampaignContactImport onImported={added => { setContacts(current => [...added, ...current.filter(contact => !added.some(item => item.id === contact.id))]); setReviewing(false); }} /> : <p className={styles.hint}>A team member with contact-management permission can add phone contacts here.</p>}
  </div>;
}
