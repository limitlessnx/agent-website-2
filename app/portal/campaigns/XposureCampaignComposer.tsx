"use client";

import { useEffect, useState } from "react";
import { type PromotionTemplate } from "@/lib/whatsapp-promotion-message";
import { calculateFluxCredits } from "@/lib/fluxknight-plans";
import CampaignContactImport, { type CampaignContact } from "./CampaignContactImport";
import styles from "./XposureCampaigns.module.css";

type CampaignTemplate = PromotionTemplate & { purpose: string };
const templateKey = (template: PromotionTemplate) => `${template.name}:${template.language}`;
type Customer = { id: string; full_name: string; phone: string | null };
type Review = {
  campaignId: string;
  reviewFingerprint: string;
  writerValues?: Record<string, string>;
  recipientCount: number;
  sampleName: string;
  message: string;
  header: string;
  footer: string;
  buttonLabels: string[];
};
const digits = (phone: string | null) => (phone || "").replace(/^\+/, "");

export default function XposureCampaignComposer({ customers, canManageContacts }: { customers: Customer[]; canManageContacts: boolean }) {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [template, setTemplate] = useState<CampaignTemplate | null>(null);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templateError, setTemplateError] = useState("");
  const [contactError, setContactError] = useState("");
  const [error, setError] = useState("");
  const [canUseAiFormatting, setCanUseAiFormatting] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"review" | "send" | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load(path: string) {
      const response = await fetch(`/api/portal/campaigns/${path}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load campaign information.");
      return payload;
    }
    void Promise.allSettled([load("meta-templates"), load("contacts")]).then(([promotion, audience]) => {
      if (controller.signal.aborted) return;
      const available: CampaignTemplate[] = promotion.status === "fulfilled" ? promotion.value.promotions || [] : [];
      setTemplates(available);
      setTemplate(promotion.status === "fulfilled" ? promotion.value.promotion || available[0] || null : null);
      setReview(null);
      setTemplateError(promotion.status === "rejected" ? promotion.reason.message : "");
      setContacts(audience.status === "fulfilled" ? audience.value.contacts : []);
      setContactError(audience.status === "rejected" ? audience.reason.message : "");
      setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);

  const phoneCounts = new Map<string, number>();
  for (const contact of contacts) {
    const phone = digits(contact.phone);
    if (phone) phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
  }
  const eligible = contacts.filter(contact => contact.whatsapp_consent === "opted_in" &&
    /^[1-9]\d{7,14}$/.test(digits(contact.phone)) && phoneCounts.get(digits(contact.phone)) === 1);
  const eligibleIds = new Set(eligible.map(contact => contact.id));
  const recipients = selected.filter(id => eligibleIds.has(id));
  const crmOnly = customers.filter(customer => !phoneCounts.has(digits(customer.phone)));
  const messageReady = message.trim().length > 0 && message.length <= 4000;
  const issues = [
    !loading && !template && !templateError && "The approved WhatsApp promotion is unavailable.",
    !messageReady && "Write a promotional message to continue.",
    !loading && !contactError && !eligible.length && "Add contacts with recorded WhatsApp marketing permission.",
    !loading && !contactError && eligible.length > 0 && !recipients.length && "Select at least one eligible contact.",
    recipients.length > 0 && !consent && "Confirm marketing consent for the selected contacts.",
  ].filter((issue): issue is string => typeof issue === "string" && Boolean(issue));
  const canReview = Boolean(template && messageReady && recipients.length && consent && !loading && !templateError && !contactError);

  function changeSelection(next: string[]) {
    setSelected(next);
    setConsent(false);
    setReview(null);
    setCanUseAiFormatting(false);
    setError("");
    setNotice("");
  }

  function changeMessage(next: string) {
    setMessage(next);
    setReview(null);
    setCanUseAiFormatting(false);
    setError("");
    setNotice("");
  }

  function refresh() {
    changeSelection([]);
    setLoading(true);
    setReload(current => current + 1);
  }

  async function submit(action: "review" | "send", useAiFormatting = false) {
    if (!canReview || pending || (action === "send" && !review)) return;
    setPending(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/portal/campaigns/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, message, contactIds: recipients, whatsappConsentConfirmed: consent,
          campaignTemplate: template ? { name: template.name, language: template.language } : undefined,
          campaignId: review?.campaignId, reviewFingerprint: review?.reviewFingerprint,
          writerValues: review?.writerValues, useAiFormatting,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setCanUseAiFormatting(payload.canUseAiFormatting === true);
        throw new Error(payload.error || "Campaign request failed.");
      }
      setCanUseAiFormatting(false);
      if (action === "review") {
        setReview(payload);
        return;
      }
      changeSelection([]);
      setNotice(`${payload.accepted} accepted by WhatsApp, ${payload.skipped} skipped. Delivery confirmation is pending.${payload.unknown ? ` ${payload.unknown} unconfirmed. Check delivery records before trying again.` : ""}`);
    } catch (reason) {
      if (action === "review") setReview(null);
      setError(reason instanceof Error ? reason.message : "Campaign request failed. Check the result before trying again.");
    } finally {
      setPending(null);
    }
  }

  return <div className={styles.workspace}>
    <div className={styles.promotionColumns}>
      <section className={`${styles.card} ${styles.promotionMessage}`} aria-labelledby="campaign-message-heading">
        <div className={styles.heading}><div><h2 id="campaign-message-heading">Campaign message</h2><p>Choose the approved marketing template for your campaign. Maia formats your message for the selected template.</p></div></div>
        {loading && <p role="status">Checking approved marketing templates and loading contacts…</p>}
        {templateError && <p className={styles.error} role="alert">{templateError}</p>}
        {template && <div className={styles.promotionFields}>
          <label className={styles.field}>Campaign template<select value={templateKey(template)} disabled={Boolean(pending)} onChange={event => { setTemplate(templates.find(item => templateKey(item) === event.target.value) || null); setReview(null); setCanUseAiFormatting(false); setError(""); setNotice(""); }}>
            {templates.map(item => <option key={templateKey(item)} value={templateKey(item)}>{item.name.replaceAll("_", " ")} · {item.language}</option>)}
          </select></label>
          <label className={styles.field}>Message<textarea rows={7} value={message} maxLength={4000} disabled={Boolean(pending)} onChange={event => changeMessage(event.target.value)} aria-describedby="promotion-message-hint" /></label>
          <p id="promotion-message-hint" className={styles.hint}>Your message is automatically formatted on the server. You will see the approved WhatsApp preview before sending.</p>

        </div>}
        {(contactError || templateError || error) && <div className={styles.importActions}><button type="button" className={styles.secondary} disabled={loading || Boolean(pending)} onClick={refresh}>Refresh campaign information</button></div>}
      </section>

      <section className={`${styles.card} ${styles.promotionAudience}`} aria-labelledby="campaign-audience-heading">
        <div className={styles.heading}><div><h2 id="campaign-audience-heading">Studio contacts</h2><p>{eligible.length} eligible · {contacts.length + crmOnly.length} total</p></div>
          <button type="button" className={styles.textButton} disabled={loading || Boolean(pending) || !eligible.length} onClick={() => changeSelection(recipients.length === eligible.length ? [] : eligible.map(contact => contact.id))}>{recipients.length === eligible.length && eligible.length ? "Clear selection" : "Select eligible"}</button>
        </div>
        {contactError && <p className={styles.error} role="alert">{contactError}</p>}
        <div className={styles.audience}>
          {contacts.map(contact => <label className={styles.contact} key={contact.id}>
            <input type="checkbox" checked={eligibleIds.has(contact.id) && selected.includes(contact.id)} disabled={loading || Boolean(pending) || !eligibleIds.has(contact.id)} onChange={event => changeSelection(event.target.checked ? [...selected, contact.id] : selected.filter(id => id !== contact.id))} />
            <span><strong>{contact.full_name}</strong><small>{contact.phone || "No phone number"}</small><small className={eligibleIds.has(contact.id) ? styles.optedIn : ""}>{eligibleIds.has(contact.id) ? "Marketing permission recorded" : contact.whatsapp_consent === "opted_out" ? "Opted out · excluded" : contact.whatsapp_consent === "opted_in" ? "Invalid or duplicate number · excluded" : "No marketing permission · excluded"}</small></span>
          </label>)}
          {crmOnly.map(customer => <div className={styles.contact} key={`crm:${customer.id}`}><span><strong>{customer.full_name}</strong><small>{customer.phone || "No phone number"}</small><small>No marketing permission · excluded</small></span></div>)}
        </div>
        {!contacts.length && !crmOnly.length && !contactError && !loading && <p className={styles.empty}>No studio contacts yet. Add contacts below to build your audience.</p>}
      </section>

      <section className={`${styles.card} ${styles.promotionReview}`} aria-labelledby="campaign-review-heading" aria-busy={Boolean(pending)}>
        <div className={styles.heading}><div><h2 id="campaign-review-heading">Review and send</h2><p>{recipients.length} selected</p></div></div>
        <label className={styles.consent}>
          <input type="checkbox" checked={consent} disabled={loading || Boolean(pending) || !recipients.length} onChange={event => { setConsent(event.target.checked); setReview(null); setError(""); }} />
          <span>I confirm that the selected contacts gave Xposure permission to send them marketing messages on WhatsApp.</span>
        </label>
        {issues.length > 0 && <ul id="promotion-review-issues" className={styles.reviewIssues} aria-live="polite">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {(templateError || contactError) && <p className={styles.hint}>Refresh campaign information before reviewing.</p>}
        {!review && <button type="button" className={styles.primary} disabled={!canReview || Boolean(pending)} aria-describedby={issues.length ? "promotion-review-issues" : undefined} onClick={() => void submit("review")}>{pending === "review" ? "Checking campaign…" : "Review campaign"}</button>}
        {canUseAiFormatting && !review && <button type="button" className={styles.secondary} disabled={!canReview || Boolean(pending)} onClick={() => void submit("review", true)}>
          Try AI formatting · {calculateFluxCredits("web_ai", 1)} Flux Credits
        </button>}
        {review && <div className={styles.confirm} role="region" aria-label="Final campaign preview" tabIndex={-1} ref={element => { element?.focus(); }}>
          <h3>Final WhatsApp preview</h3>
          <p>Preview for {review.sampleName} · {review.recipientCount} selected</p>
          <div className={styles.message}>
            {review.header && <strong>{review.header}</strong>}
            <p>{review.message}</p>
            {review.footer && <small>{review.footer}</small>}
            {review.buttonLabels.map((label, index) => <span className={styles.previewButton} key={index}>{label}</span>)}
          </div>
          <div className={styles.importActions}>
            <button type="button" className={styles.primary} disabled={Boolean(pending)} onClick={() => void submit("send")}>{pending === "send" ? "Submitting…" : "Send campaign"}</button>
            <button type="button" className={styles.secondary} disabled={Boolean(pending)} onClick={() => setReview(null)}>Back to editing</button>
          </div>
        </div>}
        {notice && <p className={styles.success} role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    </div>
    {canManageContacts ? <fieldset className={styles.promotionImport} disabled={Boolean(pending)}><CampaignContactImport onImported={added => { setContacts(current => [...added, ...current.filter(contact => !added.some(item => item.id === contact.id))]); changeSelection([]); }} /></fieldset> : <p className={styles.hint}>A team member with contact-management permission can add phone contacts here.</p>}
  </div>;
}
