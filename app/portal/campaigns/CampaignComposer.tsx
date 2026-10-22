"use client";
import { useEffect, useMemo, useState } from "react";

type Template = { name: string; language: string; category: string; placeholder_count: number; placeholder_indexes: number[] };
type Customer = { id: string; full_name: string; phone: string | null; email: string | null };

export default function CampaignComposer({ customers }: { customers: Customer[] }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en_US");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/portal/campaigns/meta-templates", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load Meta templates.");
      setTemplates(payload.templates || []);
      if (payload.templates?.[0]) { setSelectedTemplate(payload.templates[0].name); setSelectedLanguage(payload.templates[0].language || "en_US"); }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Meta templates.")).finally(() => setLoadingTemplates(false));
  }, []);

  const template = useMemo(() => templates.find((item) => item.name === selectedTemplate) || null, [selectedTemplate, templates]);
  const toggleCustomer = (id: string) => setSelectedCustomers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submit = async () => {
    setError(""); setNotice("");
    if (!selectedTemplate || !selectedCustomers.length) { setError("Choose a template and at least one client."); return; }
    if (!window.confirm(`Send ${selectedTemplate} to ${selectedCustomers.length} selected client${selectedCustomers.length === 1 ? "" : "s"}?`)) return;
    setSending(true);
    try {
      const response = await fetch("/api/portal/campaigns/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateName: selectedTemplate, languageCode: selectedLanguage, customerIds: selectedCustomers, variables }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Campaign send failed.");
      setNotice(`Campaign submitted: ${payload.accepted} accepted by Meta, ${payload.failed} failed.`);
      setSelectedCustomers([]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Campaign send failed."); } finally { setSending(false); }
  };

  return <div className="exposure-campaign-grid">
    <section className="exposure-panel exposure-campaign-card"><header><div><p className="portal-kicker">Meta WhatsApp campaign</p><h2>Choose an approved template</h2><p>Only templates approved in your connected Meta Business Account can be sent.</p></div></header>
      {loadingTemplates ? <p className="exposure-empty">Loading approved templates…</p> : null}
      {!loadingTemplates && !templates.length && !error ? <p className="exposure-empty">No approved Meta templates are available yet.</p> : null}
      <div className="exposure-template-grid">{templates.map((item) => <button type="button" className={selectedTemplate === item.name ? "is-selected" : ""} onClick={() => { setSelectedTemplate(item.name); setSelectedLanguage(item.language || "en_US"); }} key={`${item.name}:${item.language}`}><strong>{item.name}</strong><span>{item.category || "Marketing"} · {item.language || "en_US"}</span><small>{item.placeholder_count} placeholder{item.placeholder_count === 1 ? "" : "s"}</small></button>)}</div>
      {template?.placeholder_indexes.length ? <div className="exposure-variable-grid">{template.placeholder_indexes.map((index) => <label key={index}><span>Template value {index}</span><input value={variables[String(index)] || ""} onChange={(event) => setVariables((current) => ({ ...current, [String(index)]: event.target.value }))} placeholder={`Value for {{${index}}}`} /></label>)}</div> : null}
      <div className="exposure-sendbar"><div><strong>{selectedCustomers.length} client{selectedCustomers.length === 1 ? "" : "s"} selected</strong><small>Meta acceptance and delivery status are recorded separately.</small></div><button type="button" className="portal-button" onClick={submit} disabled={sending || !selectedTemplate || !selectedCustomers.length} aria-busy={sending}>{sending ? "Sending…" : "Send campaign"}</button></div>
      {notice ? <p className="exposure-success" role="status">{notice}</p> : null}{error ? <p className="exposure-error" role="alert">{error}</p> : null}
    </section>
    <section className="exposure-panel"><header><div><p className="portal-kicker">Audience</p><h2>Select studio clients</h2><p>Recipients are loaded from this organization only.</p></div><button type="button" className="exposure-select-all" onClick={() => setSelectedCustomers(selectedCustomers.length === customers.length ? [] : customers.map((customer) => customer.id))}>{selectedCustomers.length === customers.length ? "Clear all" : "Select all"}</button></header><div className="exposure-audience-list">{customers.map((customer) => <label key={customer.id}><input type="checkbox" checked={selectedCustomers.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} /><span><strong>{customer.full_name}</strong><small>{customer.phone || customer.email || "No contact detail"}</small></span></label>)}{!customers.length ? <p className="exposure-empty">No studio clients are available yet.</p> : null}</div></section>
  </div>;
}
