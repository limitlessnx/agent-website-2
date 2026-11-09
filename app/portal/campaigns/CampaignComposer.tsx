"use client";
import { useEffect, useMemo, useState } from "react";

type Template = { name: string; language: string; category: string; placeholder_count: number; placeholder_indexes: number[]; purpose?:string;variable_keys?:string[];body?:string };
const templateKey=(item:Template)=>`${item.name}:${item.language}`;
type Customer = { id: string; full_name: string; phone: string | null; email: string | null };

export default function CampaignComposer({ customers, hotel = false }: { customers: Customer[]; hotel?: boolean }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en_US");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [uncertain,setUncertain]=useState(false);

  useEffect(() => {
    fetch("/api/portal/campaigns/meta-templates", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load Meta templates.");
      const available:Template[]=(payload.templates||[]).filter((item:Template)=>!hotel||item.purpose==="hotel_campaign");
      setTemplates(available);
      if (available[0]) { setSelectedTemplate(templateKey(available[0])); setSelectedLanguage(available[0].language || "en_US"); }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Meta templates.")).finally(() => setLoadingTemplates(false));
  }, [hotel]);

  const template = useMemo(() => templates.find((item) => templateKey(item) === selectedTemplate) || null, [selectedTemplate, templates]);
  const editableIndexes=template?.placeholder_indexes.filter(index=>!hotel||template.variable_keys?.[index-1]!=="customer_name")||[];
  const complete=editableIndexes.every(index=>variables[String(index)]?.trim());
  const preview=template?.body?.replace(/\{\{\s*(\d+)\s*\}\}/g,(match,index)=>hotel&&template.variable_keys?.[Number(index)-1]==="customer_name"?customers.find(customer=>selectedCustomers.includes(customer.id))?.full_name||"{{customer_name}}":variables[String(index)]||match);
  const toggleCustomer = (id: string) => setSelectedCustomers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submit = async () => {
    setError(""); setNotice("");
    if (uncertain||!template||!complete||!selectedCustomers.length) { setError("Choose a template, fill its values and select recipients."); return; }
    if (!window.confirm(`Send ${template.name} (${selectedLanguage}) to ${selectedCustomers.length} selected client${selectedCustomers.length === 1 ? "" : "s"}?`)) return;
    setSending(true);
    let definitiveRejection=false;
    try {
      const response = await fetch("/api/portal/campaigns/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateName: template.name, languageCode: selectedLanguage, ...(hotel?{templatePurpose:"hotel_campaign"}:{}),customerIds: selectedCustomers, variables }) });
      const payload = await response.json();
      if (!response.ok) {definitiveRejection=response.status>=400&&response.status<500;if(response.status>=500)setUncertain(true);throw new Error(payload.error || "Campaign send failed.");}
      const unknown=Number(payload.unknown||0);if(unknown)setUncertain(true);
      setNotice(`Campaign submitted: ${payload.accepted} accepted by Meta, ${payload.failed} failed, ${payload.skipped || 0} skipped.${unknown?` ${unknown} unknown; review provider records before retrying.`:""} Acceptance does not confirm delivery.`);
      setSelectedCustomers([]);
    } catch (reason) { if(!definitiveRejection)setUncertain(true);setError(reason instanceof Error ? reason.message : "Campaign result is unconfirmed. Check it before retrying."); } finally { setSending(false); }
  };

  return <div className="exposure-campaign-grid">
    <section className="exposure-panel exposure-campaign-card"><header><div><p className="portal-kicker">Meta WhatsApp campaign</p><h2>Choose an approved template</h2><p>Only templates approved in your connected Meta Business Account can be sent.</p></div></header>
      {loadingTemplates ? <p className="exposure-empty">Loading approved templates…</p> : null}
      {!loadingTemplates && !templates.length && !error ? <p className="exposure-empty">No approved Meta templates are available yet.</p> : null}
      <div className="exposure-template-grid">{templates.map((item) => <button type="button" disabled={sending||uncertain} className={selectedTemplate === templateKey(item) ? "is-selected" : ""} onClick={() => { setSelectedTemplate(templateKey(item)); setSelectedLanguage(item.language || "en_US");setVariables({}); }} key={templateKey(item)}><strong>{item.name}</strong><span>{item.category || "Marketing"} · {item.language || "en_US"}</span><small>{item.placeholder_count} placeholder{item.placeholder_count === 1 ? "" : "s"}</small></button>)}</div>
      {editableIndexes.length ? <div className="exposure-variable-grid">{editableIndexes.map((index) => <label key={index}><span>{hotel?template?.variable_keys?.[index-1]?.replaceAll("_"," ")||`Template value ${index}`:`Template value ${index}`}</span><input value={variables[String(index)] || ""} maxLength={1024} disabled={sending||uncertain} onChange={(event) => setVariables((current) => ({ ...current, [String(index)]: event.target.value }))} placeholder={`Value for {{${index}}}`} /></label>)}</div> : null}
      {hotel&&template?<section className="exposure-panel" aria-label="Campaign message preview"><h3>Message preview</h3><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{preview||"Template text is unavailable. Check the approved wording before sending."}</p><small>Each recipient gets their own name. Consent, active bookings and manager handover are checked before sending.</small></section>:null}
      <div className="exposure-sendbar"><div><strong>{selectedCustomers.length} client{selectedCustomers.length === 1 ? "" : "s"} selected</strong><small>Meta acceptance and delivery status are recorded separately.</small></div><button type="button" className="portal-button" onClick={submit} disabled={sending || uncertain || !complete || !selectedTemplate || !selectedCustomers.length} aria-busy={sending}>{sending ? "Sending…" : uncertain?"Review delivery before retrying":"Send campaign"}</button></div>
      {uncertain?<p className="exposure-error" role="alert">The outcome needs review. No automatic retry is available here.</p>:null}
      {notice ? <p className="exposure-success" role="status">{notice}</p> : null}{error ? <p className="exposure-error" role="alert">{error}</p> : null}
    </section>
    <section className="exposure-panel"><header><div><p className="portal-kicker">Audience</p><h2>{hotel ? "Select guests" : "Select studio clients"}</h2><p>Recipients are loaded from this organization only.</p></div><button type="button" className="exposure-select-all" onClick={() => setSelectedCustomers(selectedCustomers.length === customers.length ? [] : customers.map((customer) => customer.id))}>{selectedCustomers.length === customers.length ? "Clear all" : "Select all"}</button></header><div className="exposure-audience-list">{customers.map((customer) => <label key={customer.id}><input type="checkbox" checked={selectedCustomers.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} /><span><strong>{customer.full_name}</strong><small>{customer.phone || customer.email || "No contact detail"}</small></span></label>)}{!customers.length ? <p className="exposure-empty">{hotel ? "No guests are available yet." : "No studio clients are available yet."}</p> : null}</div></section>
  </div>;
}
