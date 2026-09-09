"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageSquareText, PlugZap, ShieldCheck, Trash2 } from "@/components/admin/ServerIcons";

type Mode = "twilio_sandbox" | "twilio_production" | "meta_direct";

type Props = {
  integration: {
    id: string;
    status: string;
    has_credentials: boolean;
    secret_keys: string[];
  };
};

const modeCopy: Record<Mode, { title: string; badge: string; description: string }> = {
  twilio_sandbox: {
    title: "Twilio Sandbox",
    badge: "Best for free / pilot clients",
    description: "Use Twilio's WhatsApp Sandbox to activate a limited pilot without registering a production sender yet.",
  },
  twilio_production: {
    title: "Twilio Production",
    badge: "Best for live clients",
    description: "Connect a production WhatsApp sender already approved in the client's Twilio account or Fluxknight-managed subaccount.",
  },
  meta_direct: {
    title: "Meta Direct",
    badge: "Fallback",
    description: "Use a direct Meta WhatsApp Cloud API connection when the client is not being routed through Twilio.",
  },
};

export default function WhatsAppOnboardingControl({ integration }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("twilio_sandbox");
  const [open, setOpen] = useState(!integration.has_credentials);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const fields = useMemo(() => {
    if (mode === "meta_direct") {
      return [
        { key: "access_token", label: "Meta access token", type: "password" },
        { key: "phone_number_id", label: "Phone number ID", type: "text" },
        { key: "business_account_id", label: "WhatsApp Business Account ID", type: "text" },
      ];
    }

    return [
      { key: "twilio_account_sid", label: "Twilio Account SID", type: "text" },
      { key: "twilio_auth_token", label: "Twilio Auth Token", type: "password" },
      { key: "twilio_whatsapp_from", label: mode === "twilio_sandbox" ? "Sandbox WhatsApp number" : "Production WhatsApp sender", type: "text" },
      { key: "twilio_messaging_service_sid", label: "Messaging Service SID (optional)", type: "text", optional: true },
    ];
  }, [mode]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const credentials = Object.fromEntries(
        fields
          .filter((field) => !field.optional || values[field.key]?.trim())
          .map((field) => [field.key, values[field.key] || ""]),
      );

      const response = await fetch(`/api/admin/integrations/${integration.id}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials,
          configuration: {
            connection_mode: mode,
            provider_family: mode.startsWith("twilio") ? "twilio" : "meta",
            pilot: mode === "twilio_sandbox",
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to save WhatsApp connection.");
      setValues({});
      setOpen(false);
      setMessage(mode === "twilio_sandbox" ? "Sandbox connection saved. This tenant can now be prepared as a WhatsApp pilot." : "WhatsApp connection saved securely.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save WhatsApp connection.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this tenant's WhatsApp integration and remove its stored credentials?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/integrations/${integration.id}/credentials`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to disconnect WhatsApp.");
      setMessage("WhatsApp disconnected.");
      setOpen(true);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disconnect WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: "min(620px, 100%)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button className="admin-button secondary" type="button" onClick={() => setOpen((value) => !value)} disabled={busy}>
          <MessageSquareText size={14} /> {integration.has_credentials ? "Manage WhatsApp" : "Connect WhatsApp"}
        </button>
        {integration.has_credentials ? (
          <button className="admin-button secondary" type="button" onClick={disconnect} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Disconnect
          </button>
        ) : null}
      </div>

      {open ? (
        <div style={{ display: "grid", gap: 14, padding: 16, border: "1px solid rgba(168,85,247,.2)", borderRadius: 14, background: "rgba(255,255,255,.02)" }}>
          <div>
            <strong style={{ display: "block", marginBottom: 5 }}>Choose how this client will use WhatsApp</strong>
            <span className="muted">Free and pilot clients can start with Twilio Sandbox. Live client senders can move to production without changing the tenant architecture.</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
            {(Object.keys(modeCopy) as Mode[]).map((key) => {
              const option = modeCopy[key];
              const selected = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setMode(key); setValues({}); }}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 12,
                    border: selected ? "1px solid rgba(192,132,252,.75)" : "1px solid rgba(168,85,247,.18)",
                    background: selected ? "rgba(126,34,206,.18)" : "rgba(255,255,255,.02)",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                  aria-pressed={selected}
                >
                  <strong style={{ display: "block", fontSize: 13 }}>{option.title}</strong>
                  <small style={{ display: "block", marginTop: 3, color: "#d8b4fe" }}>{option.badge}</small>
                </button>
              );
            })}
          </div>

          <div className="admin-list-row compact" style={{ alignItems: "flex-start" }}>
            <ShieldCheck size={15} />
            <div>
              <strong>{modeCopy[mode].title}</strong>
              <span>{modeCopy[mode].description}</span>
            </div>
          </div>

          <form onSubmit={save} style={{ display: "grid", gap: 10 }}>
            {fields.map((field) => (
              <label key={field.key} style={{ display: "grid", gap: 5 }}>
                <span className="muted">{field.label}</span>
                <input
                  className="admin-input"
                  type={field.type}
                  value={values[field.key] || ""}
                  placeholder={integration.has_credentials ? "Enter replacement value" : field.label}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  required={!field.optional}
                  autoComplete="off"
                />
              </label>
            ))}
            <button className="admin-button" type="submit" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : <PlugZap size={14} />} Save WhatsApp connection
            </button>
          </form>

          <div className="admin-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            <div className="admin-list-row compact"><CheckCircle2 size={14} /><div><strong>Tenant isolated</strong><span>Credentials stay attached to this organization only.</span></div></div>
            <div className="admin-list-row compact"><CheckCircle2 size={14} /><div><strong>Pilot friendly</strong><span>Sandbox can be used for free clients before production sender approval.</span></div></div>
            <div className="admin-list-row compact"><CheckCircle2 size={14} /><div><strong>Upgrade path</strong><span>Move the same tenant to a production Twilio sender later.</span></div></div>
          </div>
        </div>
      ) : null}

      {integration.has_credentials && integration.secret_keys.length ? (
        <small className="muted">Stored fields: {integration.secret_keys.join(", ").replaceAll("_", " ")}</small>
      ) : null}
      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}
